import {prisma} from '../database/prisma';
import { AppError } from '../utils/errorHandler';
import { StatusCodes } from 'http-status-codes';
import { embedText } from '../utils/embeddings'; // Will be created/moved later
import { KnowledgeChunk, KnowledgeSource } from '../../generated/prisma/client';

interface CreateKnowledgeSourcePayload {
  sourceType: string;
  sourceId?: string;
  title?: string;
  category: string;
  isActive?: boolean;
}

interface UpdateKnowledgeSourcePayload {
  sourceType?: string;
  sourceId?: string;
  title?: string;
  category?: string;
  isActive?: boolean;
}

interface CreateKnowledgeChunkPayload {
  sourceId: string;
  content: string;
  lang?: string;
}

interface UpdateKnowledgeChunkPayload {
  content?: string;
  lang?: string;
}

class KnowledgeService {
  /**
   * Retrieves all knowledge sources.
   * @returns An array of knowledge sources.
   */
  public async getAllKnowledgeSources(): Promise<KnowledgeSource[]> {
    return prisma.knowledgeSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });
  }

  /**
   * Retrieves a knowledge source by its ID.
   * @param id The ID of the knowledge source.
   * @returns The knowledge source, or null if not found.
   */
  public async getKnowledgeSourceById(id: string): Promise<KnowledgeSource | null> {
    return prisma.knowledgeSource.findUnique({
      where: { id },
      include: {
        chunks: true,
      },
    });
  }

  /**
   * Creates a new knowledge source.
   * @param payload The data for the new knowledge source.
   * @returns The newly created knowledge source.
   */
  public async createKnowledgeSource(payload: CreateKnowledgeSourcePayload): Promise<KnowledgeSource> {
    return prisma.knowledgeSource.create({
      data: {
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        title: payload.title,
        category: payload.category,
        isActive: payload.isActive !== undefined ? payload.isActive : true,
      },
    });
  }

  /**
   * Updates an existing knowledge source.
   * @param id The ID of the knowledge source to update.
   * @param payload The data to update.
   * @returns The updated knowledge source.
   */
  public async updateKnowledgeSource(id: string, payload: UpdateKnowledgeSourcePayload): Promise<KnowledgeSource> {
    try {
      const source = await prisma.knowledgeSource.update({
        where: { id },
        data: payload,
      });
      return source;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new AppError('Knowledge source not found', StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Deletes a knowledge source.
   * @param id The ID of the knowledge source to delete.
   */
  public async deleteKnowledgeSource(id: string): Promise<void> {
    try {
      await prisma.knowledgeSource.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new AppError('Knowledge source not found', StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Creates a new knowledge chunk and generates its embedding.
   * @param payload The data for the new knowledge chunk.
   * @returns The newly created knowledge chunk.
   */
  public async createKnowledgeChunk(payload: CreateKnowledgeChunkPayload): Promise<KnowledgeChunk> {
    const { sourceId, content, lang } = payload;

    const embedding = await embedText(content); // Placeholder for embedding generation

    const chunk = await prisma.knowledgeChunk.create({
      data: {
        sourceId,
        content,
        lang,
        embedding: embedding as any, // Cast to any because Prisma's Unsupported type
      },
    });
    return chunk;
  }

  /**
   * Updates an existing knowledge chunk and regenerates its embedding if content changes.
   * @param id The ID of the knowledge chunk to update.
   * @param payload The data to update.
   * @returns The updated knowledge chunk.
   */
  public async updateKnowledgeChunk(id: string, payload: UpdateKnowledgeChunkPayload): Promise<KnowledgeChunk> {
    const existingChunk = await prisma.knowledgeChunk.findUnique({ where: { id } });
    if (!existingChunk) {
      throw new AppError('Knowledge chunk not found', StatusCodes.NOT_FOUND);
    }

    const data: any = { ...payload };
    if (payload.content && payload.content !== existingChunk.content) {
      data.embedding = await embedText(payload.content) as any;
    }

    try {
      const chunk = await prisma.knowledgeChunk.update({
        where: { id },
        data,
      });
      return chunk;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new AppError('Knowledge chunk not found', StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Deletes a knowledge chunk.
   * @param id The ID of the knowledge chunk to delete.
   */
  public async deleteKnowledgeChunk(id: string): Promise<void> {
    try {
      await prisma.knowledgeChunk.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new AppError('Knowledge chunk not found', StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Chunks text and creates multiple knowledge chunks for a given source.
   * @param sourceId The ID of the knowledge source.
   * @param content The full text content to chunk.
   * @param lang The language of the content.
   * @returns The number of chunks created.
   */
  public async createChunksForSource(sourceId: string, content: string, lang: string = 'en'): Promise<number> {
    const knowledgeSource = await prisma.knowledgeSource.findUnique({
      where: { id: sourceId },
    });

    if (!knowledgeSource) {
      throw new AppError('Knowledge Source not found', StatusCodes.NOT_FOUND);
    }

    const textChunks = this.chunkText(content); // Use internal chunkText method

    let count = 0;
    for (let i = 0; i < textChunks.length; i++) {
      const chunkContent = textChunks[i];
      const embedding = await embedText(chunkContent);

      // Note: metadata is not directly stored in KnowledgeChunk model in schema.prisma
      // If needed, consider adding a 'metadata Json?' field to KnowledgeChunk
      // For now, we'll just create the chunk with content, embedding, and lang.

      await prisma.knowledgeChunk.create({
        data: {
          sourceId,
          content: chunkContent,
          embedding: embedding as any,
          lang,
        },
      });
      count++;
    }
    return count;
  }

  /**
   * Helper function to chunk text.
   * @param text The text to chunk.
   * @param chunkSize The maximum size of each chunk.
   * @param overlap The overlap between chunks.
   * @returns An array of text chunks.
   */
  private chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks = [];
    let i = 0;

    while (i < text.length) {
      let end = Math.min(i + chunkSize, text.length);
      let chunk = text.substring(i, end);

      if (end < text.length) {
        const lastSpace = chunk.lastIndexOf(" ");
        if (lastSpace > chunkSize * 0.8) {
          chunk = chunk.substring(0, lastSpace);
        }
      }

      chunks.push(chunk.trim());
      i += chunkSize - overlap;

      if (i < 0) i = 0;
    }

    return chunks.filter((c) => c.length > 0);
  }
}

export default new KnowledgeService();
