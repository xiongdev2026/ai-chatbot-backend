import express from "express";
import {
  getChatLogs,
  getChatLogById,
  updateChatLog,
} from "../controllers/chatlog.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

// All chatlog routes require ADMIN access
router.use(protect, restrictTo("ADMIN"));

// GET all logs
router.get("/", getChatLogs);

// GET single log + conversation context
router.get("/:id", getChatLogById);

// UPDATE log
router.put("/:id", updateChatLog);

export default router;
