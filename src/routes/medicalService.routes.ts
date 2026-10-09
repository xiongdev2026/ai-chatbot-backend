import express from "express";
import {
  getMedicalServices,
  getMedicalServiceById,
  createMedicalService,
  updateMedicalService,
  deleteMedicalService,
} from "../controllers/medicalService.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";
import { cacheMiddleware } from "../middleware/cacheMiddleware";

const router = express.Router();

// GET all services
router.get("/", cacheMiddleware(300), getMedicalServices);

// GET by ID
router.get("/:id", cacheMiddleware(300), getMedicalServiceById);

// CREATE
router.post("/", protect, restrictTo("ADMIN"), createMedicalService);

// UPDATE
router.put("/:id", protect, restrictTo("ADMIN"), updateMedicalService);

// DELETE
router.delete("/:id", protect, restrictTo("ADMIN"), deleteMedicalService);

export default router;
