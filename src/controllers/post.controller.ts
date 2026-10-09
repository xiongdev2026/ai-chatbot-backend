import { Request, Response, NextFunction } from "express";
import postService from "../services/post.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";

/* =========================
   GET POSTS (?status=, ?page=, ?limit=)
========================= */
export async function getPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, page, limit } = req.query;
    const posts = await postService.getAllPosts(
      status as string,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(posts.data, "Posts retrieved successfully", StatusCodes.OK, {
      total: posts.total,
      page: posts.page,
      limit: posts.limit,
      totalPages: posts.totalPages,
    });
  } catch (error) {
    next(error);
  }
}

/* =========================
   GET POST BY ID
========================= */
export async function getPostById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const post = await postService.getPostById(id);

    if (!post) {
      return next(new AppError("Post not found", StatusCodes.NOT_FOUND));
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(post, "Post retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/* =========================
   CREATE POST (slug logic)
========================= */
export async function createPost(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, content, status, createdBy } = req.body;

    if (!title) {
      return next(new AppError("Title is required", StatusCodes.BAD_REQUEST));
    }

    const post = await postService.createPost({ title, content, status, createdBy });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(post, "Post created successfully", StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
}

/* =========================
   UPDATE POST
========================= */
export async function updatePost(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { title, content, status } = req.body;

    const updatedPost = await postService.updatePost(id, { title, content, status });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(updatedPost, "Post updated successfully");
  } catch (error) {
    next(error);
  }
}

/* =========================
   DELETE POST
========================= */
export async function deletePost(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await postService.deletePost(id);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(null, "Post deleted successfully", StatusCodes.OK);
  } catch (error) {
    next(error);
  }
}
