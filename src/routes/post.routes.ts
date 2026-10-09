import express from "express";
import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
} from "../controllers/post.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

/* POSTS */
router.get("/", getPosts);
router.post("/", protect, restrictTo("ADMIN"), createPost);

/* SINGLE POST */
router.get("/:id", getPostById);
router.put("/:id", protect, restrictTo("ADMIN"), updatePost);
router.delete("/:id", protect, restrictTo("ADMIN"), deletePost);

export default router;
