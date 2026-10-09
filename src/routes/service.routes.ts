import express from "express";
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} from "../controllers/service.controller";
import { protect, restrictTo } from "../middleware/auth.middleware";
import { cacheMiddleware } from "../middleware/cacheMiddleware";

const router = express.Router();

/* LIST */
router.get("/", cacheMiddleware(300), getServices);

/* CREATE */
router.post("/", protect, restrictTo("ADMIN"), createService);

/* SINGLE */
router.get("/:id", cacheMiddleware(300), getServiceById);

/* UPDATE */
router.put("/:id", protect, restrictTo("ADMIN"), updateService);

/* DELETE */
router.delete("/:id", protect, restrictTo("ADMIN"), deleteService);

export default router;
