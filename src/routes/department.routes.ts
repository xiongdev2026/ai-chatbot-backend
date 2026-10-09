import express from "express";
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../controllers/department.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

// GET all departments
router.get("/", getDepartments);

// GET by ID
router.get("/:id", getDepartmentById);

// CREATE
router.post("/", protect, restrictTo("ADMIN"), createDepartment);

// UPDATE
router.put("/:id", protect, restrictTo("ADMIN"), updateDepartment);

// DELETE
router.delete("/:id", protect, restrictTo("ADMIN"), deleteDepartment);

export default router;
