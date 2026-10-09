import express from "express";
import { chat, getChatLogs, getUserConversations } from "../controllers/chat.controller";
import { protect, optionalAuth } from "../middleware/auth.middleware";

const router = express.Router();

// POST /api/chat — send a message (optional auth)
router.post("/", optionalAuth, chat);

// GET /api/chat/conversations — get all conversations for user
router.get("/conversations", protect, getUserConversations);

// GET /api/chat/:sessionId — get chat history for a specific session
router.get("/:sessionId", optionalAuth, getChatLogs);

export default router;
