
import type { Response } from "express";
import ollama from "ollama";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

const AI_MODEL = "llama3.2:3b";

const SUMMARY_PROMPT = `
You are CareerPilot AI, a professional resume writer who helps
students, fresh graduates, and job seekers.

Write a concise, professional resume summary tailored to the
user's target job role.

Rules:
- Use only facts supplied by the user.
- Never invent skills, qualifications, employers, achievements,
  experience, certifications, or measurable results.
- If the user has limited experience, focus honestly on their
  education, projects, skills, and career interests.
- Use clear, professional language.
- Avoid generic claims such as "hardworking" unless supported.
- Return only the resume summary, without headings, quotation
  marks, or explanatory commentary.
- Aim for 50 to 100 words when the supplied information allows.
`;

export async function generateResumeSummary(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      message: "Please sign in to generate resume content.",
    });
    return;
  }

  const body = req.body ?? {};

  const role =
    typeof body.role === "string" ? body.role.trim() : "";

  const education =
    typeof body.education === "string"
      ? body.education.trim()
      : "";

  const skills =
    typeof body.skills === "string" ? body.skills.trim() : "";

  const projects =
    typeof body.projects === "string"
      ? body.projects.trim()
      : "";

  const experience =
    typeof body.experience === "string"
      ? body.experience.trim()
      : "";

  const currentSummary =
    typeof body.currentSummary === "string"
      ? body.currentSummary.trim()
      : "";

  if (!role) {
    res.status(400).json({
      success: false,
      message: "Please enter your target job role.",
    });
    return;
  }

  const fields = [
    { name: "Target job role", value: role, max: 150 },
    { name: "Education", value: education, max: 3000 },
    { name: "Skills", value: skills, max: 2000 },
    { name: "Projects", value: projects, max: 4000 },
    { name: "Work experience", value: experience, max: 4000 },
    { name: "Current summary", value: currentSummary, max: 2000 },
  ];

  for (const field of fields) {
    if (field.value.length > field.max) {
      res.status(400).json({
        success: false,
        message: `${field.name} must be ${field.max} characters or fewer.`,
      });
      return;
    }
  }

  const hasBackground = [
    education,
    skills,
    projects,
    experience,
    currentSummary,
  ].some((value) => value.length > 0);

  if (!hasBackground) {
    res.status(400).json({
      success: false,
      message:
        "Please enter some skills, education, projects, experience, or an existing summary before generating.",
    });
    return;
  }

  const userDetails = `
Target job role: ${role}

Education:
${education || "Not provided"}

Skills:
${skills || "Not provided"}

Projects:
${projects || "Not provided"}

Work experience:
${experience || "Not provided"}

Existing professional summary:
${currentSummary || "Not provided"}
`;

  try {
    const result = await ollama.chat({
      model: AI_MODEL,
      think: false,
      messages: [
        {
          role: "system",
          content: SUMMARY_PROMPT,
        },
        {
          role: "user",
          content:
            "Write a resume summary using these details:\n" +
            userDetails,
        },
      ],
      options: {
        num_predict: 250,
      },
    });

    const generatedSummary = result.message.content.trim();

    if (!generatedSummary) {
      res.status(502).json({
        success: false,
        message:
          "The AI returned an empty summary. Please try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Resume summary generated successfully.",
      generatedSummary,
    });
  } catch (error) {
    console.error("Resume summary generation error:", error);

    res.status(502).json({
      success: false,
      message:
        "Could not generate a summary. Check that Ollama is running and try again.",
    });
  }
}
