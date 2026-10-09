import { z } from "zod";

export const chatSchema = z.object({
  body: z.object({
    question: z.string().min(1, "Message is required").max(1000, "Message is too long"),
    sessionId: z.string().optional(),
  })
});
