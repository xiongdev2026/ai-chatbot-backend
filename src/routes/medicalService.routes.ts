import express from "express";
import {
  getMedicalServices,
  getMedicalServiceById,
  createMedicalService,
  updateMedicalService,
  deleteMedicalService,
} from "../controllers/medicalService.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

// GET all services
router.get("/", getMedicalServices);

// GET by ID
router.get("/:id", getMedicalServiceById);

// CREATE
router.post("/", protect, restrictTo("ADMIN"), createMedicalService);

// UPDATE
router.put("/:id", protect, restrictTo("ADMIN"), updateMedicalService);

// DELETE
router.delete("/:id", protect, restrictTo("ADMIN"), deleteMedicalService);

export default router;
