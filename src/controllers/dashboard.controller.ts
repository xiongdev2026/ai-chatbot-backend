import type { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";
import {
  ACCURACY_MATCHED_MIN,
  CANONICAL_ANSWER_THRESHOLD,
} from "../config/confidence";

// Response-speed buckets (wall-clock ms for the full RAG pipeline: DB + pgvector
// + Gemini generation + post-processing). Tuned for a production RAG chatbot on
// PostgreSQL/pgvector + Gemini flash, where a typical answer lands ~1–4s.
const SPEED_HIGH_MAX_MS = 2000; // <= 2s  → fast
const SPEED_MEDIUM_MAX_MS = 4500; // 2–4.5s → normal; above → slow

// Accuracy tiers come from the confidenceScore persisted per answer. The thresholds
// themselves live in ../config/confidence so this chart, the admin chat-log colours,
// and the retrieval pipeline can never drift apart again — they did: this file used
// to split at 0.9 only, which merged the low-confidence band into "closest" and made
// it invisible on the dashboard even though the chat-log table flagged it.

export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const now = new Date();

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      totalUsers,
      totalPosts,
      totalChatLogs,
      totalFaqs,
      totalKnowledgeSources,

      currentUsers,
      currentPosts,
      currentChatLogs,
      currentFaqs,
      currentKnowledgeSources,

      lastUsers,
      lastPosts,
      lastChatLogs,
      lastFaqs,
      lastKnowledgeSources,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.chatLog.count(),
      prisma.faq.count(),
      prisma.knowledgeSource.count(),

      prisma.user.count({ where: { createdAt: { gte: startOfCurrentMonth } } }),
      prisma.post.count({ where: { createdAt: { gte: startOfCurrentMonth } } }),
      prisma.chatLog.count({
        where: { createdAt: { gte: startOfCurrentMonth } },
      }),
      prisma.faq.count({ where: { createdAt: { gte: startOfCurrentMonth } } }),
      prisma.knowledgeSource.count({
        where: { createdAt: { gte: startOfCurrentMonth } },
      }),

      prisma.user.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      prisma.post.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      prisma.chatLog.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      prisma.faq.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      prisma.knowledgeSource.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
    ]);

    // =========================
    // Chat activity (7 days)
    // =========================
    const activityMap: Record<string, number> = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split("T")[0];
      activityMap[dateString] = 0;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentChats = await prisma.chatLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });

    for (const chat of recentChats) {
      const date = chat.createdAt.toISOString().split("T")[0];
      if (activityMap[date] !== undefined) {
        activityMap[date]++;
      }
    }

    const chatActivity = Object.entries(activityMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // =========================
    // Group data
    // =========================
    const [postsByStatus, usersByRole] = await Promise.all([
      prisma.post.groupBy({ by: ["status"], _count: true }),
      prisma.user.groupBy({ by: ["role"], _count: true }),
    ]);

    // =========================
    // Response speed distribution (High / Medium / Low)
    // Only rows that actually have a measured time are counted.
    // =========================
    const [speedHigh, speedMedium, speedLow] = await Promise.all([
      prisma.chatLog.count({
        where: { responseTimeMs: { not: null, lte: SPEED_HIGH_MAX_MS } },
      }),
      prisma.chatLog.count({
        where: {
          responseTimeMs: { gt: SPEED_HIGH_MAX_MS, lte: SPEED_MEDIUM_MAX_MS },
        },
      }),
      prisma.chatLog.count({
        where: { responseTimeMs: { gt: SPEED_MEDIUM_MAX_MS } },
      }),
    ]);

    const speedDistribution = [
      { label: "High", value: speedHigh },
      { label: "Medium", value: speedMedium },
      { label: "Low", value: speedLow },
    ];

    // =========================
    // RESPONSE
    // =========================
    return res.json({
      counts: {
        users: totalUsers,
        posts: totalPosts,
        chatLogs: totalChatLogs,
        faqs: totalFaqs,
        knowledgeSources: totalKnowledgeSources,
      },

      currentMonth: {
        users: currentUsers,
        posts: currentPosts,
        chatLogs: currentChatLogs,
        faqs: currentFaqs,
        knowledgeSources: currentKnowledgeSources,
      },

      previousMonth: {
        users: lastUsers,
        posts: lastPosts,
        chatLogs: lastChatLogs,
        faqs: lastFaqs,
        knowledgeSources: lastKnowledgeSources,
      },

      charts: {
        chatActivity,
        speedDistribution,
        postsByStatus: postsByStatus.map((p) => ({
          label: p.status,
          value: p._count,
        })),
        usersByRole: usersByRole.map((u) => ({
          label: u.role,
          value: u._count,
        })),
      },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    next(error);
  }
};

// Supported time windows for the accuracy Pie Chart filter (ລາຍວັນ/ອາທິດ/ເດືອນ).
type AccuracyPeriod = "day" | "week" | "month";

/**
 * Resolve a `period` query value into a rolling [from, now] window.
 *  - day   → last 24 hours (from start of today)
 *  - week  → last 7 days
 *  - month → last 30 days
 * Defaults to "month" for any missing/unknown value so the chart is never empty.
 */
const resolvePeriod = (
  raw: unknown
): { period: AccuracyPeriod; from: Date; to: Date } => {
  const to = new Date();
  const period: AccuracyPeriod =
    raw === "day" || raw === "week" || raw === "month" ? raw : "month";

  const from = new Date(to);
  if (period === "day") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }

  return { period, from, to };
};

/**
 * Accuracy distribution for the dashboard Pie Chart.
 *
 * "Accuracy" here = how often the bot answered from real, matched knowledge
 * versus declining. Each answer is bucketed by its stored confidenceScore:
 *   - matched  (>= 0.9): answered from a direct/structured hit (FAQ, department,
 *              doctor, service, post) — the strongest signal we have.
 *   - closest  (0.7 – 0.9): answered from a semantic match strong enough that the
 *              matched chunk is shown as the canonical "Database Answer".
 *   - low      (0 – 0.7): answered from retrieved context, but nothing was
 *              authoritative enough to serve as a canonical answer. These are the
 *              answers worth auditing — the bot spoke with weak backing.
 *   - fallback (score = 0 / null): nothing relevant found, bot declined. NOT a
 *              failure — declining when the knowledge base has no answer is correct.
 *
 * `bySource` further breaks the *answered* rows down by where the top match came
 * from (FAQ vs Department vs …), so "how many were answered from FAQ" is visible.
 */
export const getAccuracyStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { period, from, to } = resolvePeriod(req.query.period);
    const createdAt = { gte: from, lte: to };

    // Bucket counts via aggregate queries (cheap, index-backed on created_at).
    const [total, matched, closest, low, fallback] = await Promise.all([
      prisma.chatLog.count({ where: { createdAt } }),
      prisma.chatLog.count({
        where: { createdAt, confidenceScore: { gte: ACCURACY_MATCHED_MIN } },
      }),
      prisma.chatLog.count({
        where: {
          createdAt,
          confidenceScore: {
            gte: CANONICAL_ANSWER_THRESHOLD,
            lt: ACCURACY_MATCHED_MIN,
          },
        },
      }),
      prisma.chatLog.count({
        where: {
          createdAt,
          confidenceScore: { gt: 0, lt: CANONICAL_ANSWER_THRESHOLD },
        },
      }),
      // Fallback = explicitly 0 OR null (legacy rows written before the field existed).
      prisma.chatLog.count({
        where: {
          createdAt,
          OR: [{ confidenceScore: 0 }, { confidenceScore: null }],
        },
      }),
    ]);

    // Breakdown of ANSWERED rows by the source of their top retrieved chunk.
    // retrieved_chunks is a JSON array of { sourceType, similarity, ... }; we tally
    // the first (highest-ranked) chunk's sourceType in JS — the table is small at
    // MVP scale, so this is simpler than a JSON-path GROUP BY.
    const answeredRows = await prisma.chatLog.findMany({
      where: { createdAt, confidenceScore: { gt: 0 } },
      select: { retrievedChunks: true },
    });

    const sourceCounts: Record<string, number> = {};
    for (const row of answeredRows) {
      const chunks = row.retrievedChunks;
      if (Array.isArray(chunks) && chunks.length > 0) {
        const top = chunks[0] as { sourceType?: string } | null;
        const key =
          top && typeof top.sourceType === "string" ? top.sourceType : "Unknown";
        sourceCounts[key] = (sourceCounts[key] ?? 0) + 1;
      }
    }

    const answered = matched + closest + low;

    return res.json({
      period,
      range: { from, to },
      total,
      answered,
      // Share of questions the bot actually answered (not counting fallbacks).
      answeredRate: total > 0 ? Math.round((answered / total) * 100) : 0,
      accuracy: [
        { key: "matched", label: "ຕອບຈາກຖານຂໍ້ມູນ", value: matched },
        { key: "closest", label: "ຕອບໃກ້ຄຽງ", value: closest },
        { key: "low", label: "ໝັ້ນໃຈຕ່ຳ", value: low },
        { key: "fallback", label: "ຍັງບໍ່ມີຂໍ້ມູນ", value: fallback },
      ],
      bySource: Object.entries(sourceCounts)
        .map(([sourceType, value]) => ({ sourceType, value }))
        .sort((a, b) => b.value - a.value),
    });
  } catch (error) {
    console.error("Accuracy Stats Error:", error);
    next(error);
  }
};
