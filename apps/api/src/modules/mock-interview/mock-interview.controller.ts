import type { Response } from "express";
import { Types } from "mongoose";
import ollama from "ollama";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import MockInterview from "./mock-interview.model.js";

const AI_MODEL = "llama3.2:3b";
const QUESTION_COUNT = 5;

type InterviewType = "behavioral" | "technical" | "mixed";
type Difficulty = "beginner" | "intermediate" | "advanced";

function getUserId(req: AuthenticatedRequest): string | null {
  return req.user?.id || null;
}

function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  return JSON.parse(cleaned);
}

function clampScore(value: unknown): number {
  const score = Number(value);

  if (!Number.isFinite(score)) return 0;

  return Math.round(Math.min(100, Math.max(0, score)));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

async function generateQuestions(
  role: string,
  interviewType: InterviewType,
  difficulty: Difficulty
): Promise<string[]> {
  const result = await ollama.chat({
    model: AI_MODEL,
    think: false,
    format: "json",
    messages: [
      {
        role: "system",
        content:
          "You are an experienced interview coach. Generate realistic, role-relevant interview questions. Return only a JSON object with a questions array containing exactly five distinct strings. Do not include answers or explanations.",
      },
      {
        role: "user",
        content: `Job role: ${role}
Interview type: ${interviewType}
Difficulty: ${difficulty}

Create exactly five useful interview questions appropriate for this role and difficulty. For behavioral interviews, focus on experience, teamwork, problem-solving, and communication. For technical interviews, focus on role-relevant technical knowledge. For mixed interviews, use a balanced combination.`,
      },
    ],
    options: { num_predict: 900, temperature: 0.4 },
  });

  const parsed = parseJson(result.message.content) as {
    questions?: unknown;
  };

  if (!Array.isArray(parsed.questions)) {
    throw new Error("The AI returned an invalid question list.");
  }

  const questions = parsed.questions
    .filter(
      (question): question is string =>
        typeof question === "string" && question.trim().length > 0
    )
    .map((question) => question.trim())
    .slice(0, QUESTION_COUNT);

  if (questions.length !== QUESTION_COUNT) {
    throw new Error("The AI did not generate five valid questions.");
  }

  return questions;
}

export async function createInterview(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  const role =
    typeof req.body?.role === "string" ? req.body.role.trim() : "";
  const interviewType = req.body?.interviewType;
  const difficulty = req.body?.difficulty;

  if (!role || role.length > 100) {
    res.status(400).json({
      success: false,
      message: "Enter a job role of 1 to 100 characters.",
    });
    return;
  }

  if (!["behavioral", "technical", "mixed"].includes(interviewType)) {
    res.status(400).json({
      success: false,
      message: "Choose a valid interview type.",
    });
    return;
  }

  if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
    res.status(400).json({
      success: false,
      message: "Choose a valid difficulty.",
    });
    return;
  }

  try {
    const questions = await generateQuestions(
      role,
      interviewType as InterviewType,
      difficulty as Difficulty
    );

    const interview = await MockInterview.create({
      userId: new Types.ObjectId(userId),
      role,
      interviewType,
      difficulty,
      status: "in_progress",
      questions: questions.map((question) => ({
        question,
        answer: "",
        feedback: "",
        strengths: [],
        improvements: [],
        score: null,
        answeredAt: null,
      })),
      currentQuestionIndex: 0,
    });

    res.status(201).json({ success: true, interview });
  } catch (error) {
    console.error("Create mock interview error:", error);
    res.status(502).json({
      success: false,
      message:
        "Could not generate interview questions. Check that Ollama is running and the configured model is available, then try again.",
    });
  }
}

export async function listInterviews(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  try {
    const interviews = await MockInterview.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(30)
      .select(
        "role interviewType difficulty status currentQuestionIndex questions.question questions.score overallScore summary createdAt updatedAt"
      );

    res.status(200).json({ success: true, interviews });
  } catch (error) {
    console.error("List mock interviews error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load interview history.",
    });
  }
}

export async function getInterview(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const interviewId = String(req.params.id || "");

  if (!userId) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  if (!Types.ObjectId.isValid(interviewId)) {
    res.status(400).json({ success: false, message: "Invalid interview ID." });
    return;
  }

  try {
    const interview = await MockInterview.findOne({
      _id: interviewId,
      userId,
    });

    if (!interview) {
      res.status(404).json({
        success: false,
        message: "Interview not found.",
      });
      return;
    }

    res.status(200).json({ success: true, interview });
  } catch (error) {
    console.error("Get mock interview error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load this interview.",
    });
  }
}

export async function submitAnswer(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = getUserId(req);
  const interviewId = String(req.params.id || "");
  const answer =
    typeof req.body?.answer === "string" ? req.body.answer.trim() : "";

  if (!userId) {
    res.status(401).json({ success: false, message: "Please sign in." });
    return;
  }

  if (!Types.ObjectId.isValid(interviewId)) {
    res.status(400).json({ success: false, message: "Invalid interview ID." });
    return;
  }

  if (!answer || answer.length > 5000) {
    res.status(400).json({
      success: false,
      message: "Your answer must be between 1 and 5000 characters.",
    });
    return;
  }

  try {
    const interview = await MockInterview.findOne({
      _id: interviewId,
      userId,
    });

    if (!interview) {
      res.status(404).json({
        success: false,
        message: "Interview not found.",
      });
      return;
    }

    if (interview.status === "completed") {
      res.status(400).json({
        success: false,
        message: "This interview has already been completed.",
      });
      return;
    }

    const index = interview.currentQuestionIndex;
    const question = interview.questions[index];

    if (!question) {
      res.status(400).json({
        success: false,
        message: "No unanswered question is available.",
      });
      return;
    }

    const result = await ollama.chat({
      model: AI_MODEL,
      think: false,
      format: "json",
      messages: [
        {
          role: "system",
          content:
            "You are a fair, encouraging interview practice coach. Evaluate only the supplied answer in relation to the question and job role. Be specific, constructive, and age-neutral. Do not claim your score is an objective hiring prediction. Return a JSON object with score (integer 0-100), feedback (string), strengths (array of up to 3 short strings), and improvements (array of up to 3 short strings). Assess relevance, clarity, reasoning, and completeness. Do not reward length alone.",
        },
        {
          role: "user",
          content: `Job role: ${interview.role}
Interview type: ${interview.interviewType}
Difficulty: ${interview.difficulty}
Question: ${question.question}
Candidate answer: ${answer}

Evaluate this answer for practice purposes. Return valid JSON only.`,
        },
      ],
      options: { num_predict: 500, temperature: 0.2 },
    });

    const parsed = parseJson(result.message.content) as {
      score?: unknown;
      feedback?: unknown;
      strengths?: unknown;
      improvements?: unknown;
    };

    const feedback =
      typeof parsed.feedback === "string" ? parsed.feedback.trim() : "";

    if (!feedback) {
      throw new Error("The AI returned empty feedback.");
    }

    question.answer = answer;
    question.feedback = feedback.slice(0, 3000);
    question.strengths = stringArray(parsed.strengths);
    question.improvements = stringArray(parsed.improvements);
    question.score = clampScore(parsed.score);
    question.answeredAt = new Date();

    interview.currentQuestionIndex += 1;

    if (interview.currentQuestionIndex >= interview.questions.length) {
      interview.status = "completed";

      const scores: number[] = interview.questions
  .map((item: { score: number | null }) => item.score)
  .filter((score: number | null): score is number => score !== null);

interview.overallScore =
  scores.length > 0
    ? Math.round(
        scores.reduce(
          (total: number, score: number) => total + score,
          0
        ) / scores.length
      )
    : 0;

      interview.summary =
        interview.overallScore >= 80
          ? "Strong practice performance. Keep refining your examples and explaining your reasoning clearly."
          : interview.overallScore >= 60
            ? "A promising practice attempt. Review the feedback for each answer and practise giving more specific, structured responses."
            : "Use this attempt as a baseline. Practise structuring your answers, addressing the question directly, and adding relevant examples.";
    }

    await interview.save();

    res.status(200).json({
      success: true,
      interview,
      evaluation: {
        score: question.score,
        feedback: question.feedback,
        strengths: question.strengths,
        improvements: question.improvements,
      },
    });
  } catch (error) {
    console.error("Submit mock interview answer error:", error);
    res.status(502).json({
      success: false,
      message:
        "Could not evaluate your answer. Your answer has not been saved; please try again.",
    });
  }
}