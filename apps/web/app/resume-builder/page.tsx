
"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type ResumeTemplate = "modern" | "ats";

type ResumeData = {
  _id?: string;
  id?: string;
  title?: string;
  resumeTemplate?: ResumeTemplate;
  personalInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
  };
  role?: string;
  summary?: string;
  education?: string;
  skills?: string;
  projects?: string;
  experience?: string;
  certifications?: string;
  achievements?: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  resume?: ResumeData | null;
  generatedSummary?: string;
};

export default function ResumeBuilderPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("");
  const [summary, setSummary] = useState("");
  const [education, setEducation] = useState("");
  const [skills, setSkills] = useState("");
  const [projects, setProjects] = useState("");
  const [experience, setExperience] = useState("");
  const [certifications, setCertifications] = useState("");
  const [achievements, setAchievements] = useState("");
  const [resumeTemplate, setResumeTemplate] =
    useState<ResumeTemplate>("modern");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [aiMessage, setAiMessage] = useState("");
  const [aiError, setAiError] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadResume() {
      const token = localStorage.getItem("careerpilot_token");

      if (!token) {
        if (!cancelled) {
          setSaveMessage("Please sign in to load or save your resume.");
          setSaveError(true);
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/resume/builder`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = (await response.json()) as ApiResponse;

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Could not load your resume.");
        }

        if (cancelled) return;

        const resume = result.resume;

        if (resume) {
          setName(resume.personalInfo?.name ?? "");
          setEmail(resume.personalInfo?.email ?? "");
          setPhone(resume.personalInfo?.phone ?? "");
          setLocation(resume.personalInfo?.location ?? "");
          setRole(resume.role ?? "");
          setSummary(resume.summary ?? "");
          setEducation(resume.education ?? "");
          setSkills(resume.skills ?? "");
          setProjects(resume.projects ?? "");
          setExperience(resume.experience ?? "");
          setCertifications(resume.certifications ?? "");
          setAchievements(resume.achievements ?? "");
          setResumeTemplate(
            resume.resumeTemplate === "ats" ? "ats" : "modern"
          );
          setSaveMessage("Your saved resume has been loaded.");
          setSaveError(false);
        } else {
          setSaveMessage("No saved resume yet. Fill in the form and save it.");
          setSaveError(false);
        }
      } catch (error) {
        if (!cancelled) {
          setSaveMessage(
            error instanceof Error
              ? error.message
              : "Could not load your resume."
          );
          setSaveError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadResume();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveResume() {
    const token = localStorage.getItem("careerpilot_token");

    if (!token) {
      setSaveError(true);
      setSaveMessage("Please sign in again before saving your resume.");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");
    setSaveError(false);

    try {
      const response = await fetch(`${API_URL}/api/resume/builder`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "My Resume",
          resumeTemplate,
          personalInfo: { name, email, phone, location },
          role,
          summary,
          education,
          skills,
          projects,
          experience,
          certifications,
          achievements,
        }),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not save your resume.");
      }

      setSaveMessage(result.message || "Resume saved successfully.");
      setSaveError(false);
    } catch (error) {
      setSaveError(true);
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function generateSummary() {
    if (!role.trim()) {
      setAiError(true);
      setAiMessage("Please enter your target job role first.");
      return;
    }

    const hasBackground = [
      education,
      skills,
      projects,
      experience,
      summary,
      certifications,
      achievements,
    ].some((value) => value.trim());

    if (!hasBackground) {
      setAiError(true);
      setAiMessage(
        "Please enter some education, skills, projects, experience, or an existing summary first."
      );
      return;
    }

    const token = localStorage.getItem("careerpilot_token");

    if (!token) {
      setAiError(true);
      setAiMessage("Please sign in again to use AI resume writing.");
      return;
    }

    setIsGenerating(true);
    setAiMessage("");
    setAiError(false);

    try {
      const response = await fetch(`${API_URL}/api/resume/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role,
          education,
          skills,
          projects,
          experience,
          currentSummary: summary,
        }),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not generate your summary."
        );
      }

      if (!result.generatedSummary?.trim()) {
        throw new Error(
          "The AI returned an empty summary. Please try again."
        );
      }

      setSummary(result.generatedSummary.trim());
      setAiError(false);
      setAiMessage(
        "Summary generated successfully! Save your resume to keep this change."
      );
    } catch (error) {
      setAiError(true);
      setAiMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadResume() {
    if (!name.trim() || !email.trim() || !role.trim()) {
      alert("Please enter your name, email, and target job role.");
      return;
    }

    const isAts = resumeTemplate === "ats";

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = isAts ? 20 : 18;
    const contentWidth = pageWidth - margin * 2;
    let y = isAts ? 22 : 20;

    function addText(
      text: string,
      options: {
        bold?: boolean;
        size?: number;
        color?: [number, number, number];
      } = {}
    ) {
      if (!text.trim()) return;

      const size = options.size ?? 10;
      const color = options.color ?? [30, 41, 59];

      pdf.setFont("helvetica", options.bold ? "bold" : "normal");
      pdf.setFontSize(size);
      pdf.setTextColor(color[0], color[1], color[2]);

      const lines = pdf.splitTextToSize(text, contentWidth);
      const lineHeight = size * 0.45 + 2;
      const requiredHeight = lines.length * lineHeight + 2;

      if (y + requiredHeight > pageHeight - 16) {
        pdf.addPage();
        y = isAts ? 22 : 20;
      }

      pdf.text(lines, margin, y);
      y += requiredHeight;
    }

    function addSection(title: string, content: string) {
      if (!content.trim()) return;

      y += isAts ? 3 : 2;

      if (isAts) {
        addText(title.toUpperCase(), {
          bold: true,
          size: 11,
          color: [0, 0, 0],
        });

        pdf.setDrawColor(70, 70, 70);
        pdf.setLineWidth(0.25);
        pdf.line(margin, y - 1, pageWidth - margin, y - 1);
        y += 1;

        addText(content.trim(), {
          size: 10,
          color: [0, 0, 0],
        });
      } else {
        addText(title.toUpperCase(), {
          bold: true,
          size: 11,
          color: [2, 132, 199],
        });

        addText(content.trim(), {
          size: 10,
          color: [51, 65, 85],
        });
      }
    }

    addText(name.trim(), {
      bold: true,
      size: isAts ? 18 : 20,
      color: isAts ? [0, 0, 0] : [15, 23, 42],
    });

    const contact = [email.trim(), phone.trim(), location.trim()]
      .filter(Boolean)
      .join(" | ");

    if (contact) {
      addText(contact, {
        size: 9,
        color: isAts ? [0, 0, 0] : [71, 85, 105],
      });
    }

    y += 2;

    pdf.setDrawColor(
      ...(isAts
        ? ([0, 0, 0] as [number, number, number])
        : ([14, 165, 233] as [number, number, number]))
    );
    pdf.setLineWidth(isAts ? 0.35 : 0.8);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 4;

    addSection(
      "Career Objective",
      `Seeking an opportunity as ${role.trim()}.`
    );
    addSection("Professional Summary", summary);
    addSection("Education", education);
    addSection("Technical Skills", skills);
    addSection("Projects", projects);
    addSection("Work Experience", experience);
    addSection("Certifications", certifications);
    addSection("Achievements", achievements);

    const totalPages = pdf.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
      pdf.setPage(page);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        `CareerPilot AI | Page ${page} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
    }

    pdf.save(
      isAts
        ? "CareerPilot-ATS-Classic-Resume.pdf"
        : "CareerPilot-Modern-Resume.pdf"
    );
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-sky-500";

  const isAts = resumeTemplate === "ats";

  const previewClass = isAts
    ? "h-fit rounded-lg border border-slate-300 bg-white p-6 text-black shadow-xl sm:p-8 lg:sticky lg:top-6 font-serif"
    : "h-fit rounded-2xl border border-slate-300 bg-white p-6 text-slate-900 shadow-xl sm:p-8 lg:sticky lg:top-6";

  const previewHeadingClass = isAts
    ? "mt-5 border-b border-black pb-1 text-sm font-bold uppercase tracking-wide"
    : "mt-5 text-sm font-bold uppercase tracking-wide text-sky-700";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <a
          href="/dashboard"
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          ← Back to Dashboard
        </a>

        <header className="mb-8 mt-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
            CareerPilot AI
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Resume Builder
          </h1>
          <p className="mt-3 text-slate-300">
            Build a professional resume with AI assistance, preview it,
            save it to your account, and download it as a PDF.
          </p>
        </header>

        {isLoading && (
          <p role="status" className="mb-4 text-sm text-slate-300">
            Loading your saved resume...
          </p>
        )}

        {saveMessage && (
          <p
            role="status"
            aria-live="polite"
            className={`mb-4 text-sm ${
              saveError ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {saveMessage}
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-7">
            <h2 className="mb-6 text-xl font-bold">Your Information</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="resumeTemplate" className="text-sm font-medium">
                  Resume template
                </label>
                <select
                  id="resumeTemplate"
                  value={resumeTemplate}
                  onChange={(e) =>
                    setResumeTemplate(e.target.value as ResumeTemplate)
                  }
                  className={fieldClass}
                >
                  <option value="modern">Modern Professional</option>
                  <option value="ats">ATS Classic</option>
                </select>
                <p className="mt-2 text-xs text-slate-400">
                  Modern Professional uses a contemporary blue accent.
                  ATS Classic uses a simple, traditional black-and-white
                  layout for straightforward parsing.
                </p>
              </div>

              <div>
                <label htmlFor="name" className="text-sm font-medium">
                  Full name *
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className={fieldClass}
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  Email address *
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={fieldClass}
                  maxLength={254}
                />
              </div>

              <div>
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone number
                </label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your phone number"
                  className={fieldClass}
                  maxLength={40}
                />
              </div>

              <div>
                <label htmlFor="location" className="text-sm font-medium">
                  City / Location
                </label>
                <input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, Country"
                  className={fieldClass}
                  maxLength={150}
                />
              </div>

              <div>
                <label htmlFor="role" className="text-sm font-medium">
                  Target job role *
                </label>
                <input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Junior Software Developer"
                  className={fieldClass}
                  maxLength={150}
                />
              </div>

              <div>
                <label htmlFor="summary" className="text-sm font-medium">
                  Professional summary
                </label>
                <textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Briefly describe your skills and career goals..."
                  rows={4}
                  className={fieldClass}
                  maxLength={5000}
                />

                <button
                  type="button"
                  onClick={generateSummary}
                  disabled={isGenerating}
                  className="mt-3 w-full rounded-xl border border-sky-500 px-5 py-3 font-semibold text-sky-300 transition hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating
                    ? "Generating your summary..."
                    : "✨ Generate with AI"}
                </button>

                {aiMessage && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`mt-3 text-sm ${
                      aiError ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {aiMessage}
                  </p>
                )}

                <p className="mt-2 text-xs text-slate-400">
                  AI uses your supplied information to draft a summary.
                  Review and edit the result, then save it before leaving.
                </p>
              </div>

              <div>
                <label htmlFor="education" className="text-sm font-medium">
                  Education
                </label>
                <textarea
                  id="education"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="Degree, institution, graduation year..."
                  rows={3}
                  className={fieldClass}
                  maxLength={5000}
                />
              </div>

              <div>
                <label htmlFor="skills" className="text-sm font-medium">
                  Skills
                </label>
                <textarea
                  id="skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="JavaScript, React, TypeScript..."
                  rows={3}
                  className={fieldClass}
                  maxLength={5000}
                />
              </div>

              <div>
                <label htmlFor="projects" className="text-sm font-medium">
                  Projects
                </label>
                <textarea
                  id="projects"
                  value={projects}
                  onChange={(e) => setProjects(e.target.value)}
                  placeholder="Project name, technologies, and achievements..."
                  rows={4}
                  className={fieldClass}
                  maxLength={10000}
                />
              </div>

              <div>
                <label htmlFor="experience" className="text-sm font-medium">
                  Work experience
                </label>
                <textarea
                  id="experience"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Job title, company, dates, and achievements..."
                  rows={4}
                  className={fieldClass}
                  maxLength={10000}
                />
              </div>

              <div>
                <label htmlFor="certifications" className="text-sm font-medium">
                  Certifications
                </label>
                <textarea
                  id="certifications"
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  placeholder="Certification name, issuing organization, and year..."
                  rows={3}
                  className={fieldClass}
                  maxLength={5000}
                />
              </div>

              <div>
                <label htmlFor="achievements" className="text-sm font-medium">
                  Achievements
                </label>
                <textarea
                  id="achievements"
                  value={achievements}
                  onChange={(e) => setAchievements(e.target.value)}
                  placeholder="Awards, accomplishments, competitions, or measurable results..."
                  rows={3}
                  className={fieldClass}
                  maxLength={5000}
                />
              </div>

              <button
                type="button"
                onClick={saveResume}
                disabled={isSaving || isLoading}
                className="w-full rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving your resume..." : "Save Resume"}
              </button>

              <button
                type="button"
                onClick={downloadResume}
                className="w-full rounded-xl bg-sky-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Download Resume (PDF)
              </button>

              <p className="text-xs text-slate-400">
                Complete your name, email, and target job role before
                downloading. Remember to save after making changes.
              </p>
            </div>
          </section>

          <section className={previewClass}>
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Live Preview · {isAts ? "ATS Classic" : "Modern Professional"}
            </p>

            <h2
              className={`break-words text-2xl font-bold ${
                isAts ? "text-black" : "text-slate-900"
              }`}
            >
              {name.trim() || "Your Name"}
            </h2>

            <p className="mt-2 break-words text-sm text-slate-600">
              {[email, phone, location]
                .map((value) => value.trim())
                .filter(Boolean)
                .join(" | ") || "Email | Phone | Location"}
            </p>

            <div
              className={`mt-5 border-b-2 ${
                isAts ? "border-black" : "border-sky-600"
              }`}
            />

            <h3 className={previewHeadingClass}>Career Objective</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {role.trim()
                ? `Seeking an opportunity as ${role.trim()}.`
                : "Your target job role will appear here."}
            </p>

            <h3 className={previewHeadingClass}>Professional Summary</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {summary.trim() || "Your professional summary will appear here."}
            </p>

            <h3 className={previewHeadingClass}>Education</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {education.trim() || "Add your education details."}
            </p>

            <h3 className={previewHeadingClass}>Skills</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {skills.trim() || "Add your relevant skills."}
            </p>

            <h3 className={previewHeadingClass}>Projects</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {projects.trim() || "Add your projects and achievements."}
            </p>

            <h3 className={previewHeadingClass}>Experience</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {experience.trim() ||
                "Add your work experience, or state that you are a fresher."}
            </p>

            <h3 className={previewHeadingClass}>Certifications</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {certifications.trim() || "Add your certifications."}
            </p>

            <h3 className={previewHeadingClass}>Achievements</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {achievements.trim() || "Add your achievements."}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
