
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function ResumePage() {
  const [resumeText, setResumeText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyzeResume() {
    setError("");
    setFeedback("");

    if (resumeText.trim().length < 50) {
      setError("Please enter at least 50 characters of resume text.");
      return;
    }

    if (resumeText.trim().length > 12000) {
      setError("Your resume must be 12,000 characters or fewer.");
      return;
    }

    const token = localStorage.getItem("careerpilot_token");

    if (!token) {
      window.location.href = "/";
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/resume/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            resumeText: resumeText.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not analyze your resume."
        );
      }

      setFeedback(data.feedback);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadReview() {
    if (!feedback) return;

    const fileContent = [
      "CAREERPILOT AI",
      "RESUME REVIEW",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "========================================",
      "AI FEEDBACK",
      "========================================",
      "",
      feedback,
      "",
      "========================================",
      "Review all AI suggestions for accuracy before using them.",
    ].join("\n");

    const blob = new Blob(["\uFEFF", fileContent], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "CareerPilot-Resume-Review.txt";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
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
            Resume Assistant
          </h1>

          <p className="mt-3 max-w-2xl text-slate-300">
            Get practical AI feedback to improve your resume,
            highlight your strengths, and present your experience
            more professionally.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl sm:p-7">
          <label
            htmlFor="resume"
            className="mb-3 block text-lg font-semibold"
          >
            Paste your resume
          </label>

          <p className="mb-4 text-sm text-slate-400">
            Include your education, skills, projects, experience,
            and achievements. Remove personal details you do not
            want to share.
          </p>

          <textarea
            id="resume"
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            placeholder="Paste your resume text here..."
            rows={13}
            maxLength={12000}
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />

          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>Minimum 50 characters</span>
            <span>{resumeText.length}/12000</span>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={analyzeResume}
            disabled={loading}
            className="mt-5 w-full rounded-xl bg-sky-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Analyzing your resume..." : "Analyze My Resume"}
          </button>

          {loading && (
            <p className="mt-3 text-sm text-slate-400">
              AI is reviewing your resume. This may take a little
              while on your computer.
            </p>
          )}
        </section>

        {feedback && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl sm:p-7">
            <h2 className="mb-5 text-2xl font-bold">
              Your Resume Review
            </h2>

            <div className="resume-feedback space-y-4 text-sm leading-7 text-slate-200">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => (
                    <h2 className="border-b border-slate-700 pb-2 pt-3 text-xl font-semibold text-sky-400">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="pt-2 text-lg font-semibold text-white">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-slate-300">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc space-y-2 pl-6">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal space-y-2 pl-6">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="pl-1 text-slate-300">
                      {children}
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-white">
                      {children}
                    </strong>
                  ),
                }}
              >
                {feedback}
              </ReactMarkdown>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={downloadReview}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Download Resume Review
              </button>

              <button
                type="button"
                onClick={() => {
                  setFeedback("");
                  setError("");
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
                className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-medium transition hover:bg-slate-800"
              >
                Review Another Resume
              </button>
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-xs leading-5 text-slate-500">
          AI suggestions are a starting point. Review all changes
          for accuracy before using your resume in a job application.
        </p>
      </div>
    </main>
  );
}
