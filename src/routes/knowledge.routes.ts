import express from "express";
import {
  getSources,
  getSourceById,
  createSource,
  updateSource,
  deleteSource,
  createChunks,
} from "../controllers/knowledge.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

/* SOURCES */
router.get("/", getSources);
router.post("/", protect, restrictTo("ADMIN"), createSource);

router.get("/:id", getSourceById);
router.put("/:id", protect, restrictTo("ADMIN"), updateSource);
router.delete("/:id", protect, restrictTo("ADMIN"), deleteSource);

/* CHUNKS */
router.post("/:id/chunks", protect, restrictTo("ADMIN"), createChunks);

export default router;
