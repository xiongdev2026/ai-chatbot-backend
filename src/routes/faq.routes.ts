import express from "express";
import {
  getFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
} from "../controllers/faq.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

// GET all FAQs
router.get("/", getFaqs);

// GET FAQ by ID
router.get("/:id", getFaqById);

// CREATE FAQ
router.post("/", protect, restrictTo("ADMIN"), createFaq);

// UPDATE FAQ
router.put("/:id", protect, restrictTo("ADMIN"), updateFaq);

// DELETE FAQ
router.delete("/:id", protect, restrictTo("ADMIN"), deleteFaq);

export default router;
