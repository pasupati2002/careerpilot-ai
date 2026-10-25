
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { connectDB } from "./config/database.js";
import authRoutes from "./modules/auth/auth.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import resumeRoutes from "./modules/resume/resume.routes.js";
import consultationRoutes from "./modules/consultations/consultations.routes.js";
import { handleRazorpayWebhook } from "./modules/consultations/consultations.controller.js";
import mockInterviewRoutes from "./modules/mock-interview/mock-interview.routes.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
  })
);

// Register this before express.json() so the original bytes are preserved.
app.post(
  "/api/consultations/webhook",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),
  handleRazorpayWebhook
);

// Parse JSON for the normal API routes.
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/mock-interviews", mockInterviewRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CareerPilot API is running",
  });
});

async function startServer(): Promise<void> {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start the API server:", error);
    process.exit(1);
  }
}

startServer();
