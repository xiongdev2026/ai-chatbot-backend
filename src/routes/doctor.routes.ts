import express from "express";
import {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} from "../controllers/doctor.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";
import { cacheMiddleware } from "../middleware/cacheMiddleware";

const router = express.Router();

// GET all doctors
router.get("/", cacheMiddleware(300), getDoctors);

// GET doctor by ID
router.get("/:id", cacheMiddleware(300), getDoctorById);

// CREATE
router.post("/", protect, restrictTo("ADMIN"), createDoctor);

// UPDATE
router.put("/:id", protect, restrictTo("ADMIN"), updateDoctor);

// DELETE
router.delete("/:id", protect, restrictTo("ADMIN"), deleteDoctor);

export default router;
