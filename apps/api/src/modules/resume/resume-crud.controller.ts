
import type { Request, Response, RequestHandler } from "express";
import { Resume } from "./resume.model.js";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

const FIELD_LIMITS: Record<string, number> = {
  title: 100,
  name: 100,
  email: 254,
  phone: 40,
  location: 150,
  role: 150,
  summary: 5000,
  education: 5000,
  skills: 5000,
  projects: 10000,
  experience: 10000,
};

const VALID_TEMPLATES = ["modern", "ats"] as const;

type ResumeTemplate = (typeof VALID_TEMPLATES)[number];

function readText(value: unknown, field: string): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  const maxLength = FIELD_LIMITS[field];

  if (maxLength !== undefined && trimmedValue.length > maxLength) {
    return null;
  }

  return trimmedValue;
}

function isResumeTemplate(value: unknown): value is ResumeTemplate {
  return (
    typeof value === "string" &&
    VALID_TEMPLATES.includes(value as ResumeTemplate)
  );
}

/**
 * GET /api/resume/builder
 * Load the authenticated user's saved resume.
 */
export const getSavedResume: RequestHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authenticatedReq = req as AuthenticatedRequest;

  try {
    const resume = await Resume.findOne({
      userId: authenticatedReq.user.id,
    }).lean();

    res.status(200).json({
      success: true,
      resume: resume
        ? {
            id: resume._id.toString(),
            title: resume.title,
            resumeTemplate: resume.resumeTemplate ?? "modern",
            personalInfo: {
              name: resume.personalInfo?.name ?? "",
              email: resume.personalInfo?.email ?? "",
              phone: resume.personalInfo?.phone ?? "",
              location: resume.personalInfo?.location ?? "",
            },
            role: resume.role ?? "",
            summary: resume.summary ?? "",
            education: resume.education ?? "",
            skills: resume.skills ?? "",
            projects: resume.projects ?? "",
            experience: resume.experience ?? "",
            createdAt: resume.createdAt,
            updatedAt: resume.updatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Error loading saved resume:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load your saved resume.",
    });
  }
};

/**
 * PUT /api/resume/builder
 * Create or update the authenticated user's saved resume.
 */
export const saveResume: RequestHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authenticatedReq = req as AuthenticatedRequest;
  const body = req.body as Record<string, unknown>;

  const personalInfo =
    body.personalInfo &&
    typeof body.personalInfo === "object" &&
    !Array.isArray(body.personalInfo)
      ? (body.personalInfo as Record<string, unknown>)
      : {};

  const fields = {
    title: readText(body.title ?? "My Resume", "title"),
    name: readText(personalInfo.name ?? "", "name"),
    email: readText(personalInfo.email ?? "", "email"),
    phone: readText(personalInfo.phone ?? "", "phone"),
    location: readText(personalInfo.location ?? "", "location"),
    role: readText(body.role ?? "", "role"),
    summary: readText(body.summary ?? "", "summary"),
    education: readText(body.education ?? "", "education"),
    skills: readText(body.skills ?? "", "skills"),
    projects: readText(body.projects ?? "", "projects"),
    experience: readText(body.experience ?? "", "experience"),
  };

  // Validate all text fields before saving.
  for (const [field, value] of Object.entries(fields)) {
    if (value === null) {
      res.status(400).json({
        success: false,
        message: `The ${field} field must be text and must not exceed its allowed length.`,
      });
      return;
    }
  }

  // Older clients that omit the template use Modern Professional.
  const requestedTemplate: unknown = body.resumeTemplate ?? "modern";

  if (!isResumeTemplate(requestedTemplate)) {
    res.status(400).json({
      success: false,
      message: "Please select a valid resume template.",
    });
    return;
  }

  try {
    const resume = await Resume.findOneAndUpdate(
      {
        userId: authenticatedReq.user.id,
      },
      {
        $set: {
          title: fields.title,
          resumeTemplate: requestedTemplate,
          personalInfo: {
            name: fields.name,
            email: fields.email,
            phone: fields.phone,
            location: fields.location,
          },
          role: fields.role,
          summary: fields.summary,
          education: fields.education,
          skills: fields.skills,
          projects: fields.projects,
          experience: fields.experience,
        },
        $setOnInsert: {
          userId: authenticatedReq.user.id,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Resume saved successfully.",
      resume: {
        id: resume._id.toString(),
        title: resume.title,
        resumeTemplate: resume.resumeTemplate,
        personalInfo: {
          name: resume.personalInfo?.name ?? "",
          email: resume.personalInfo?.email ?? "",
          phone: resume.personalInfo?.phone ?? "",
          location: resume.personalInfo?.location ?? "",
        },
        role: resume.role ?? "",
        summary: resume.summary ?? "",
        education: resume.education ?? "",
        skills: resume.skills ?? "",
        projects: resume.projects ?? "",
        experience: resume.experience ?? "",
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error saving resume:", error);

    res.status(500).json({
      success: false,
      message: "Unable to save your resume. Please try again.",
    });
  }
};
