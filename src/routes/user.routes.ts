import express from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/user.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

/* USERS */
router.get("/", protect, restrictTo("ADMIN"), getUsers);
router.post("/", protect, restrictTo("ADMIN"), createUser);

/* USER BY ID */
router.get("/:id", protect, restrictTo("ADMIN"), getUserById);
router.put("/:id", protect, restrictTo("ADMIN"), updateUser);
router.delete("/:id", protect, restrictTo("ADMIN"), deleteUser);

export default router;
