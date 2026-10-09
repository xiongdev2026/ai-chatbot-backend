import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { env } from "./config";
import logger from "./config/logger";
import { errorMiddleware } from "./middleware/error.middleware";
import { AppError } from "./utils/errorHandler";
import ApiResponseHandler from "./utils/apiResponse";
import {
  helmetMiddleware,
  corsMiddleware,
  limiter,
  sanitizeInput,
} from "./middleware/security.middleware";

// Import routes
import authRoutes from "./routes/auth.routes";
import chatlogRoutes from "./routes/chatlog.routes";
import departmentRoutes from "./routes/department.routes";
import doctorRoutes from "./routes/doctor.routes";
import faqRoutes from "./routes/faq.routes";
import knowledgeRoutes from "./routes/knowledge.routes";
import medicalServiceRoutes from "./routes/medicalService.routes";
import postRoutes from "./routes/post.routes";
import serviceRoutes from "./routes/service.routes";
import userRoutes from "./routes/user.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import chatRoute from "./routes/chat.routes";
import surveyRoutes from "./routes/survey.routes";

const app = express();

// Global Middlewares
app.use(helmetMiddleware); // Set security HTTP headers
app.use(corsMiddleware); // Enable CORS
app.use("/api", limiter); // Apply rate limiting to all /api requests
app.use(express.json({ limit: "10kb" })); // Body parser, reading data from body into req.body
app.use(cookieParser());
app.use(sanitizeInput); // Basic input sanitization

// Basic route
app.get("/", (req: Request, res: Response) => {
  const apiResponse = new ApiResponseHandler(res);
  apiResponse.success({ message: "Welcome to the AI Chatbot API!" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoute);
app.use("/api/chatlogs", chatlogRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/medical-services", medicalServiceRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/surveys", surveyRoutes);

// Handle undefined routes (Express 5 compatible)
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handling Middleware
app.use(errorMiddleware);

export default app;
