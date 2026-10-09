import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from '../config';

// Must match the "vector(768)" column dimension locked in via the
// add_indexes_and_rag_improvements migration (knowledge_chunks.embedding / chat_logs.embedding).
const EMBEDDING_DIMENSIONS = 768;

let genAI: GoogleGenerativeAI;
let model: any;

function getModel() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    // "embedding-001" has been retired by Google; gemini-embedding-001 is the current model.
    model = genAI.getGenerativeModel({
      model: "gemini-embedding-001",
    });
  }
  return model;
}

/**
 * Generates an embedding for the given text using the Gemini API.
 * @param text The text to embed.
 * @returns A promise that resolves to an array of numbers representing the embedding.
 */
export async function embedText(text: string): Promise<number[]> {
  // gemini-embedding-001 defaults to 3072 dimensions; outputDimensionality truncates it
  // (via Matryoshka representation learning) to match our DB column.
  const result = await getModel().embedContent({
    content: { role: "user", parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMENSIONS,
  });
  return result.embedding.values;
}
