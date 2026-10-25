
import type { Response } from "express";
import ollama from "ollama";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

const AI_MODEL = "llama3.2:3b";

const RESUME_PROMPT = `
You are CareerPilot AI, an expert resume reviewer.

Review the user's resume honestly and constructively.
Focus on clarity, professional presentation, skills, achievements,
measurable impact, grammar, and suitability for job applications.

Organize your response using these exact Markdown headings:

## Overall Assessment
Give a brief assessment of the resume.

## Strengths
List the strongest parts of the resume.

## Areas to Improve
Identify specific weaknesses or missing information.

## Actionable Suggestions
Give practical, prioritized steps for improvement.

## Improved Resume Examples
Rewrite a few relevant phrases or bullet points to make them
clearer and more professional. Do not invent experience,
qualifications, employers, achievements, or metrics.

Use clear language suitable for students and fresh graduates.
If the resume lacks information, explain what the user should add.
Never guarantee employment.
`;

export async function analyzeResume(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      message: "Please sign in to use the Resume Assistant.",
    });
    return;
  }

  const resumeText =
    typeof req.body?.resumeText === "string"
      ? req.body.resumeText.trim()
      : "";

  if (resumeText.length < 50) {
    res.status(400).json({
      success: false,
      message: "Please enter at least 50 characters of resume text.",
    });
    return;
  }

  if (resumeText.length > 12000) {
    res.status(400).json({
      success: false,
      message: "Your resume text must be 12,000 characters or fewer.",
    });
    return;
  }

  try {
    const result = await ollama.chat({
      model: AI_MODEL,
      think: false,
      messages: [
        { role: "system", content: RESUME_PROMPT },
        {
          role: "user",
          content: `Please review this resume:\n\n${resumeText}`,
        },
      ],
      options: {
        num_predict: 800,
      },
    });

    const feedback = result.message.content.trim();

    if (!feedback) {
      res.status(502).json({
        success: false,
        message: "The AI returned an empty review. Please try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Resume reviewed successfully.",
      feedback,
    });
  } catch (error) {
    console.error("Resume analysis error:", error);

    res.status(502).json({
      success: false,
      message:
        "Could not analyze your resume. Check that Ollama is running and try again.",
    });
  }
}
