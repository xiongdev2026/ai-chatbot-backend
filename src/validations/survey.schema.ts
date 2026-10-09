import { z } from "zod";

const ratingScore = z.number().int().min(1).max(5);

export const submitSurveySchema = z.object({
  body: z.object({
    sessionId: z.string().optional(),
    q1Overall: ratingScore,
    q2EaseOfUse: ratingScore,
    q3Speed: ratingScore,
    q4Accuracy: ratingScore,
    q5Understanding: ratingScore,
    q6Clarity: ratingScore,
    q7Helpfulness: ratingScore,
    q8Utility: ratingScore,
    q9ReuseIntent: ratingScore,
    q10Nps: ratingScore,
    likedMost: z.string().optional(),
    improvement: z.string().optional(),
  }),
});
