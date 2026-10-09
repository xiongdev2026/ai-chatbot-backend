import { SurveyResponse } from "../../generated/prisma/client";
import { prisma } from "../database/prisma";
import { paginate } from "../utils/pagination";
import { PaginatedResult } from "../types/pagination";

export interface CreateSurveyPayload {
  sessionId?: string;
  userId?: string;
  q1Overall: number;
  q2EaseOfUse: number;
  q3Speed: number;
  q4Accuracy: number;
  q5Understanding: number;
  q6Clarity: number;
  q7Helpfulness: number;
  q8Utility: number;
  q9ReuseIntent: number;
  q10Nps: number;
  likedMost?: string;
  improvement?: string;
}

class SurveyService {
  public async createSurvey(payload: CreateSurveyPayload): Promise<SurveyResponse> {
    return prisma.surveyResponse.create({
      data: {
        sessionId: payload.sessionId || null,
        userId: payload.userId || null,
        q1Overall: payload.q1Overall,
        q2EaseOfUse: payload.q2EaseOfUse,
        q3Speed: payload.q3Speed,
        q4Accuracy: payload.q4Accuracy,
        q5Understanding: payload.q5Understanding,
        q6Clarity: payload.q6Clarity,
        q7Helpfulness: payload.q7Helpfulness,
        q8Utility: payload.q8Utility,
        q9ReuseIntent: payload.q9ReuseIntent,
        q10Nps: payload.q10Nps,
        likedMost: payload.likedMost || null,
        improvement: payload.improvement || null,
      },
    });
  }

  public async getSurveys(
    page?: number,
    limit?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<PaginatedResult<SurveyResponse>> {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return paginate<SurveyResponse>(
      prisma.surveyResponse,
      { page, limit },
      {
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }
    );
  }

  public async getSurveyStats(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const surveys = await prisma.surveyResponse.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalEvaluations = surveys.length;

    if (totalEvaluations === 0) {
      return {
        totalEvaluations: 0,
        averageScore: 0,
        satisfactionRate: 0,
        positiveResponses: 0,
        neutralResponses: 0,
        negativeResponses: 0,
        ratingDistribution: [
          { rating: 1, label: "1 Star", count: 0 },
          { rating: 2, label: "2 Stars", count: 0 },
          { rating: 3, label: "3 Stars", count: 0 },
          { rating: 4, label: "4 Stars", count: 0 },
          { rating: 5, label: "5 Stars", count: 0 },
        ],
        questionAverages: [
          { id: "q1Overall", key: "q1_overall", label: "1. ຄວາມເພິ່ງພໍໃຈໂດຍລວມ", avg: 0 },
          { id: "q2EaseOfUse", key: "q2_ease_of_use", label: "2. ຄວາມງ່າຍໃນການໃຊ້ງານ", avg: 0 },
          { id: "q3Speed", key: "q3_speed", label: "3. ຄວາມໄວໃນການຕອບ", avg: 0 },
          { id: "q4Accuracy", key: "q4_accuracy", label: "4. ຄວາມຖືກຕ້ອງຂອງຄຳຕອບ", avg: 0 },
          { id: "q5Understanding", key: "q5_understanding", label: "5. ຄວາມເຂົ້າໃຈຄຳຖາມ", avg: 0 },
          { id: "q6Clarity", key: "q6_clarity", label: "6. ຄວາມຈະແຈ້ງຂອງຄຳຕອບ", avg: 0 },
          { id: "q7Helpfulness", key: "q7_helpfulness", label: "7. ຄວາມມີປະໂຫຍດໃນການແກ້ໄຂບັນຫາ", avg: 0 },
          { id: "q8Utility", key: "q8_utility", label: "8. ຄວາມມີປະໂຫຍດຂອງຂໍ້ມູນ", avg: 0 },
          { id: "q9ReuseIntent", key: "q9_reuse_intent", label: "9. ການກັບມາໃຊ້ງານອີກ", avg: 0 },
          { id: "q10Nps", key: "q10_nps", label: "10. ການແນະນຳໃຫ້ຜູ້ໃຊ້ອື່ນ", avg: 0 },
        ],
        recentEvaluations: [],
        userFeedback: {
          likedMost: [],
          improvement: [],
        },
      };
    }

    // Rating distribution counter (for all individual question scores)
    const distributionMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    // Sums for per-question averages
    let q1Sum = 0, q2Sum = 0, q3Sum = 0, q4Sum = 0, q5Sum = 0;
    let q6Sum = 0, q7Sum = 0, q8Sum = 0, q9Sum = 0, q10Sum = 0;
    let totalScoreSum = 0;

    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;

    const likedMostList: any[] = [];
    const improvementList: any[] = [];

    surveys.forEach((s) => {
      const qScores = [
        s.q1Overall,
        s.q2EaseOfUse,
        s.q3Speed,
        s.q4Accuracy,
        s.q5Understanding,
        s.q6Clarity,
        s.q7Helpfulness,
        s.q8Utility,
        s.q9ReuseIntent,
        s.q10Nps,
      ];

      qScores.forEach((val) => {
        if (distributionMap[val] !== undefined) {
          distributionMap[val]++;
        }
      });

      q1Sum += s.q1Overall;
      q2Sum += s.q2EaseOfUse;
      q3Sum += s.q3Speed;
      q4Sum += s.q4Accuracy;
      q5Sum += s.q5Understanding;
      q6Sum += s.q6Clarity;
      q7Sum += s.q7Helpfulness;
      q8Sum += s.q8Utility;
      q9Sum += s.q9ReuseIntent;
      q10Sum += s.q10Nps;

      const evalAvg = qScores.reduce((a, b) => a + b, 0) / 10;
      totalScoreSum += evalAvg;

      if (evalAvg >= 4.0) {
        positiveCount++;
      } else if (evalAvg <= 2.0) {
        negativeCount++;
      } else {
        neutralCount++;
      }

      if (s.likedMost && s.likedMost.trim()) {
        likedMostList.push({
          id: s.id,
          text: s.likedMost,
          createdAt: s.createdAt,
          user: s.user ? s.user.fullName || s.user.email : "Anonymous",
        });
      }

      if (s.improvement && s.improvement.trim()) {
        improvementList.push({
          id: s.id,
          text: s.improvement,
          createdAt: s.createdAt,
          user: s.user ? s.user.fullName || s.user.email : "Anonymous",
        });
      }
    });

    const averageScore = Number((totalScoreSum / totalEvaluations).toFixed(2));
    const satisfactionRate = Number(((positiveCount / totalEvaluations) * 100).toFixed(1));

    const ratingDistribution = [1, 2, 3, 4, 5].map((r) => ({
      rating: r,
      label: `${r} Stars`,
      count: distributionMap[r] || 0,
    }));

    const questionAverages = [
      { id: "q1Overall", key: "q1_overall", label: "1. ຄວາມເພິ່ງພໍໃຈໂດຍລວມ", avg: Number((q1Sum / totalEvaluations).toFixed(2)) },
      { id: "q2EaseOfUse", key: "q2_ease_of_use", label: "2. ຄວາມງ່າຍໃນການໃຊ້ງານ", avg: Number((q2Sum / totalEvaluations).toFixed(2)) },
      { id: "q3Speed", key: "q3_speed", label: "3. ຄວາມໄວໃນການຕອບ", avg: Number((q3Sum / totalEvaluations).toFixed(2)) },
      { id: "q4Accuracy", key: "q4_accuracy", label: "4. ຄວາມຖືກຕ້ອງຂອງຄຳຕອບ", avg: Number((q4Sum / totalEvaluations).toFixed(2)) },
      { id: "q5Understanding", key: "q5_understanding", label: "5. ຄວາມເຂົ້າໃຈຄຳຖາມ", avg: Number((q5Sum / totalEvaluations).toFixed(2)) },
      { id: "q6Clarity", key: "q6_clarity", label: "6. ຄວາມຈະແຈ້ງຂອງຄຳຕອບ", avg: Number((q6Sum / totalEvaluations).toFixed(2)) },
      { id: "q7Helpfulness", key: "q7_helpfulness", label: "7. ຄວາມມີປະໂຫຍດໃນການແກ້ໄຂບັນຫາ", avg: Number((q7Sum / totalEvaluations).toFixed(2)) },
      { id: "q8Utility", key: "q8_utility", label: "8. ຄວາມມີປະໂຫຍດຂອງຂໍ້ມູນ", avg: Number((q8Sum / totalEvaluations).toFixed(2)) },
      { id: "q9ReuseIntent", key: "q9_reuse_intent", label: "9. ການກັບມາໃຊ້ງານອີກ", avg: Number((q9Sum / totalEvaluations).toFixed(2)) },
      { id: "q10Nps", key: "q10_nps", label: "10. ການແນະນຳໃຫ້ຜູ້ໃຊ້ອື່ນ", avg: Number((q10Sum / totalEvaluations).toFixed(2)) },
    ];

    const recentEvaluations = surveys.slice(0, 10).map((s) => {
      const avg = Number(
        (
          [
            s.q1Overall,
            s.q2EaseOfUse,
            s.q3Speed,
            s.q4Accuracy,
            s.q5Understanding,
            s.q6Clarity,
            s.q7Helpfulness,
            s.q8Utility,
            s.q9ReuseIntent,
            s.q10Nps,
          ].reduce((a, b) => a + b, 0) / 10
        ).toFixed(2)
      );
      return {
        ...s,
        averageScore: avg,
      };
    });

    return {
      totalEvaluations,
      averageScore,
      satisfactionRate,
      positiveResponses: positiveCount,
      neutralResponses: neutralCount,
      negativeResponses: negativeCount,
      ratingDistribution,
      questionAverages,
      recentEvaluations,
      userFeedback: {
        likedMost: likedMostList,
        improvement: improvementList,
      },
    };
  }
}

export default new SurveyService();
