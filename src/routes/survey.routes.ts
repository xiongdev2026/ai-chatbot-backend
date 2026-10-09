import express, { Router } from "express";
import { submitSurvey, getSurveys, getSurveyStats } from "../controllers/survey.controller";
import { optionalAuth, protect, restrictTo } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import { submitSurveySchema } from "../validations/survey.schema";

const router: Router = express.Router();

router.post("/", optionalAuth, validate(submitSurveySchema as any), submitSurvey);
router.get("/", protect, restrictTo("ADMIN"), getSurveys);
router.get("/stats", protect, restrictTo("ADMIN"), getSurveyStats);

export default router;
