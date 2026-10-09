import express from "express";
import {
  getDashboardStats,
  getAccuracyStats,
} from "../controllers/dashboard.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

// GET /api/dashboard — Admin only
router.get("/", protect, restrictTo("ADMIN"), getDashboardStats);

// GET /api/dashboard/accuracy?period=day|week|month — Admin only
router.get("/accuracy", protect, restrictTo("ADMIN"), getAccuracyStats);

export default router;
