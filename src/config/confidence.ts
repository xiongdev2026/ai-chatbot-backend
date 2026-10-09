/**
 * The confidence thresholds that decide how an answer is retrieved, stored, and
 * displayed. They live together in one file because they describe ONE scale and
 * only make sense relative to each other:
 *
 *   0 ────────── 0.55 ────────── 0.70 ────────── 0.90 ────── 0.95
 *   │             │               │               │            │
 *   nothing       weakest hit     canonical       "answered    exact/structured
 *   found         worth using     answer is       from the     hit (FAQ, dept,
 *   (declines)                    trustworthy     KB"          doctor, service)
 *
 * They were previously duplicated across embedding.service.ts, chat.service.ts and
 * dashboard.controller.ts with values that had drifted apart (0.70 vs 0.90), so the
 * admin table and the dashboard silently disagreed about what the same answer was.
 * Import from here; never re-declare a threshold locally.
 */

/**
 * Below this cosine similarity, a "semantic" hit is too weak to be useful context.
 * Empirically, gemini-embedding-001 puts genuinely-related hospital content around
 * 0.6–0.75, while completely unrelated questions ("capital of France") still land
 * around 0.4–0.45 — so the floor must sit above that baseline noise, not just above 0.
 */
export const SEMANTIC_SIMILARITY_FLOOR = 0.55;

/**
 * At or above this, the top chunk is trustworthy enough to be shown as the
 * authoritative "Database Answer" and diffed against the bot's reply. Between
 * SEMANTIC_SIMILARITY_FLOOR and this value the bot still answers from the context,
 * but no chunk is authoritative enough to compare against — the "low confidence" band.
 */
export const CANONICAL_ANSWER_THRESHOLD = 0.7;

/**
 * At or above this, the answer came from a direct/structured hit — the strongest
 * signal available. Structured hits are stored at EXACT_MATCH_SIMILARITY, so in
 * practice this separates "matched" from strong-but-semantic matches.
 */
export const ACCURACY_MATCHED_MIN = 0.9;

/**
 * The similarity recorded for a structured/exact hit (FAQ, department, doctor,
 * medical service, service, post). Not a measured cosine distance — a fixed marker
 * that these curated sources matched the question directly.
 */
export const EXACT_MATCH_SIMILARITY = 0.95;
