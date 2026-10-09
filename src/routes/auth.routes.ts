import express, { Router } from "express";
import { register, login, logout, me } from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import { loginSchema, registerSchema } from "../validations/auth.schema";

const router: Router = express.Router();

router.post("/register", validate(registerSchema as any), register);
router.post("/login", validate(loginSchema as any), login);
router.post("/logout", logout);
router.get("/me", protect, me);

export default router;
