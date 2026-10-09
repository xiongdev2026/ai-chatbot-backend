import express from "express";
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} from "../controllers/service.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";

const router = express.Router();

/* LIST */
router.get("/", getServices);

/* CREATE */
router.post("/", protect, restrictTo("ADMIN"), createService);

/* SINGLE */
router.get("/:id", getServiceById);

/* UPDATE */
router.put("/:id", protect, restrictTo("ADMIN"), updateService);

/* DELETE */
router.delete("/:id", protect, restrictTo("ADMIN"), deleteService);

export default router;
