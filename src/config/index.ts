import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET_KEY: z.string(),
  JWT_EXPIRES_IN: z.string().default("1d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60 * 1000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100), // 100 requests per minute
  GEMINI_API_KEY: z.string(),
  AI_MODEL: z.string().default("gemini-2.5-flash"),
  // Add other environment variables as needed
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

// Optional: Log environment variables (excluding sensitive ones) for debugging
if (env.NODE_ENV === "development") {
  console.log("Loaded Environment Variables:");
  for (const key in env) {
    if (
      key !== "JWT_SECRET_KEY" &&
      key !== "DATABASE_URL" &&
      key !== "GEMINI_API_KEY"
    ) {
      console.log(`  ${key}: ${env[key as keyof Env]}`);
    }
  }
}
