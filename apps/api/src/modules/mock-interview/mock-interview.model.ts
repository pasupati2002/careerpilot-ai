import mongoose, { Schema, Types } from "mongoose";

export interface InterviewQuestion {
  question: string;
  answer: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
  score: number | null;
  answeredAt: Date | null;
}

export interface MockInterviewDocument extends mongoose.Document {
  userId: Types.ObjectId;
  role: string;
  interviewType: "behavioral" | "technical" | "mixed";
  difficulty: "beginner" | "intermediate" | "advanced";
  status: "in_progress" | "completed";
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  overallScore: number | null;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<InterviewQuestion>(
  {
    question: { type: String, required: true },
    answer: { type: String, default: "" },
    feedback: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    score: { type: Number, min: 0, max: 100, default: null },
    answeredAt: { type: Date, default: null },
  },
  { _id: false }
);

const mockInterviewSchema = new Schema<MockInterviewDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: { type: String, required: true, trim: true, maxlength: 100 },
    interviewType: {
      type: String,
      enum: ["behavioral", "technical", "mixed"],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    questions: { type: [questionSchema], default: [] },
    currentQuestionIndex: { type: Number, default: 0, min: 0 },
    overallScore: { type: Number, min: 0, max: 100, default: null },
    summary: { type: String, default: "" },
  },
  { timestamps: true }
);

mockInterviewSchema.index({ userId: 1, updatedAt: -1 });

const MockInterview =
  mongoose.models.MockInterview ||
  mongoose.model<MockInterviewDocument>(
    "MockInterview",
    mockInterviewSchema
  );

export default MockInterview;