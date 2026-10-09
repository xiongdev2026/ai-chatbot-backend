import { prisma } from "../database/prisma";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { paginate } from "../utils/pagination";
import { Post } from "../../generated/prisma/client";
import { PaginatedResult } from "../types/pagination";

interface CreatePostPayload {
  title: string;
  content?: string;
  status?: string;
  createdBy?: string;
}

interface UpdatePostPayload {
  title?: string;
  content?: string;
  status?: string;
}

class PostService {
  /**
   * Retrieves all posts, optionally filtered by status, with pagination.
   * @param status Optional status to filter posts.
   * @param page The page number for pagination.
   * @param limit The number of items per page for pagination.
   * @returns A paginated result of posts.
   */
  public async getAllPosts(
    status?: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Post>> {
    const where = status ? { status } : {};
    const posts = await paginate<Post>(
      prisma.post,
      { page, limit },
      {
        where,
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
    );
    return posts;
  }

  /**
   * Retrieves a post by its ID.
   * @param id The ID of the post.
   * @returns The post, or null if not found.
   */
  public async getPostById(id: string): Promise<Post | null> {
    return prisma.post.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Creates a new post, including slug generation.
   * @param payload The data for the new post.
   * @returns The newly created post.
   */
  public async createPost(payload: CreatePostPayload): Promise<Post> {
    const { title, content, status, createdBy } = payload;

    // Slug generation logic
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const existing = await prisma.post.findUnique({
      where: { slug },
    });

    if (existing) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
    }

    return prisma.post.create({
      data: {
        title,
        slug,
        content,
        status: status || "DRAFT",
        createdBy,
      },
      include: {
        creator: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Updates an existing post.
   * @param id The ID of the post to update.
   * @param payload The data to update.
   * @returns The updated post.
   */
  public async updatePost(
    id: string,
    payload: UpdatePostPayload,
  ): Promise<Post> {
    try {
      const post = await prisma.post.update({
        where: { id },
        data: payload,
        include: {
          creator: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
      return post;
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("Post not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Deletes a post.
   * @param id The ID of the post to delete.
   */
  public async deletePost(id: string): Promise<void> {
    try {
      await prisma.post.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("Post not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }
}

export default new PostService();
