
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type InterviewType = "behavioral" | "technical" | "mixed";
type Difficulty = "beginner" | "intermediate" | "advanced";

type Question = {
  question: string;
  answer: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
  score: number | null;
  answeredAt: string | null;
};

type Interview = {
  _id: string;
  role: string;
  interviewType: InterviewType;
  difficulty: Difficulty;
  status: "in_progress" | "completed";
  questions: Question[];
  currentQuestionIndex: number;
  overallScore: number | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
} & T;

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400";

const primaryButtonClass =
  "rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "rounded-xl border border-slate-700 px-4 py-3 text-sm transition hover:border-cyan-500 hover:bg-slate-800 disabled:opacity-50";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MockInterviewPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("Software Engineer");
  const [interviewType, setInterviewType] =
    useState<InterviewType>("mixed");
  const [difficulty, setDifficulty] =
    useState<Difficulty>("beginner");

  const [interview, setInterview] = useState<Interview | null>(null);
  const [history, setHistory] = useState<Interview[]>([]);
  const [answer, setAnswer] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    const token = localStorage.getItem("careerpilot_token");

    if (!token) {
      router.replace("/");
      throw new Error("Your session has expired. Please sign in again.");
    }

    const result = await apiRequest<
      ApiResponse<{ interviews: Interview[] }>
    >("/api/mock-interviews", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setHistory(result.interviews);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const token = localStorage.getItem("careerpilot_token");

      if (!token) {
        router.replace("/");
        return;
      }

      try {
        const result = await apiRequest<
          ApiResponse<{ interviews: Interview[] }>
        >("/api/mock-interviews", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!cancelled) {
          setHistory(result.interviews);
          setAuthorized(true);
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem("careerpilot_token");
          router.replace("/");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function startInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setWorking(true);

    try {
      const token = localStorage.getItem("careerpilot_token");

      if (!token) {
        router.replace("/");
        return;
      }

      const result = await apiRequest<
        ApiResponse<{ interview: Interview }>
      >("/api/mock-interviews", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: role.trim(),
          interviewType,
          difficulty,
        }),
      });

      setInterview(result.interview);
      setAnswer("");

      try {
        await loadHistory();
      } catch (historyError) {
        console.error("Could not refresh interview history:", historyError);
      }
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not start the interview. Please try again.")
      );
    } finally {
      setWorking(false);
    }
  }

  async function openInterview(id: string) {
    setError("");
    setWorking(true);

    try {
      const token = localStorage.getItem("careerpilot_token");

      if (!token) {
        router.replace("/");
        return;
      }

      const result = await apiRequest<
        ApiResponse<{ interview: Interview }>
      >(`/api/mock-interviews/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setInterview(result.interview);
      setAnswer("");
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not open this interview. Please try again.")
      );
    } finally {
      setWorking(false);
    }
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!interview || !answer.trim()) {
      return;
    }

    setError("");
    setWorking(true);

    try {
      const token = localStorage.getItem("careerpilot_token");

      if (!token) {
        router.replace("/");
        return;
      }

      const result = await apiRequest<
        ApiResponse<{ interview: Interview }>
      >(`/api/mock-interviews/${interview._id}/answer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answer: answer.trim(),
        }),
      });

      setInterview(result.interview);
      setAnswer("");

      try {
        await loadHistory();
      } catch (historyError) {
        console.error("Could not refresh interview history:", historyError);
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Could not evaluate your answer. Please try again."
        )
      );
    } finally {
      setWorking(false);
    }
  }

  function startNewInterview() {
    setInterview(null);
    setAnswer("");
    setError("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
          <p className="mt-4 text-slate-400">
            Loading your mock interview workspace...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  const currentQuestion = interview
    ? interview.questions[interview.currentQuestionIndex]
    : undefined;

  const completedCount = interview
    ? interview.questions.filter((question) => question.score !== null).length
    : 0;

  const questionCount = interview?.questions.length ?? 5;

  const progress = questionCount
    ? (completedCount / questionCount) * 100
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-cyan-400">
              CAREERPILOT AI
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              AI Mock Interview
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Practise interview questions tailored to your target role and
              learn how to improve each answer.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={secondaryButtonClass}
          >
            Back to dashboard
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              className="font-semibold underline underline-offset-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {!interview ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-xl text-cyan-400">
                  ✦
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    Set up your interview
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Five AI-generated questions per session
                  </p>
                </div>
              </div>

              <form onSubmit={startInterview} className="mt-7 space-y-5">
                <div>
                  <label htmlFor="role" className="text-sm font-medium">
                    Target job role
                  </label>
                  <input
                    id="role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    maxLength={100}
                    required
                    className={inputClass}
                    placeholder="e.g. Frontend Developer"
                  />
                </div>

                <div>
                  <label htmlFor="interviewType" className="text-sm font-medium">
                    Interview type
                  </label>
                  <select
                    id="interviewType"
                    value={interviewType}
                    onChange={(event) =>
                      setInterviewType(event.target.value as InterviewType)
                    }
                    className={inputClass}
                  >
                    <option value="mixed">
                      Mixed — technical and behavioral
                    </option>
                    <option value="technical">Technical</option>
                    <option value="behavioral">Behavioral</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="difficulty" className="text-sm font-medium">
                    Difficulty level
                  </label>
                  <select
                    id="difficulty"
                    value={difficulty}
                    onChange={(event) =>
                      setDifficulty(event.target.value as Difficulty)
                    }
                    className={inputClass}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={working || !role.trim()}
                  className={`${primaryButtonClass} w-full`}
                >
                  {working ? "Generating questions..." : "Start mock interview →"}
                </button>
              </form>

              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm font-medium">What you will receive</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                  <li>✓ Role-specific interview questions</li>
                  <li>✓ Individual feedback and practice scores</li>
                  <li>✓ Strengths and suggestions for improvement</li>
                  <li>✓ A saved report you can revisit later</li>
                </ul>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Scores are AI-generated learning aids and are not validated
                predictions of hiring outcomes.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    Interview history
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Continue practising or review a previous report.
                  </p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {history.length} sessions
                </span>
              </div>

              {history.length === 0 ? (
                <div className="mt-8 rounded-xl border border-dashed border-slate-700 p-6 text-center">
                  <p className="font-medium">No interviews yet</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Your sessions will appear here after you start your first
                    mock interview.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {history.map((item) => (
                    <button
                      type="button"
                      key={item._id}
                      onClick={() => void openInterview(item._id)}
                      disabled={working}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-left transition hover:border-cyan-500/60 hover:bg-slate-900 disabled:opacity-50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{item.role}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(item.updatedAt || item.createdAt)}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            item.status === "completed"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          {item.status === "completed"
                            ? "Completed"
                            : "In progress"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm capitalize text-slate-400">
                        {item.interviewType} · {item.difficulty}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm text-cyan-400">
                          {item.status === "completed"
                            ? `Score: ${item.overallScore ?? 0}/100`
                            : `${item.currentQuestionIndex}/${item.questions.length} answered`}
                        </span>
                        <span className="text-sm text-slate-500">
                          Open →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {working && (
                <p className="mt-4 text-sm text-slate-400">
                  Loading interview...
                </p>
              )}
            </section>
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-cyan-400">
                  {interview.role}
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {interview.status === "completed"
                    ? "Your interview report"
                    : "Interview in progress"}
                </h2>
                <p className="mt-2 text-sm capitalize text-slate-400">
                  {interview.interviewType} · {interview.difficulty}
                </p>
              </div>

              <button
                type="button"
                onClick={startNewInterview}
                className={secondaryButtonClass}
              >
                New interview
              </button>
            </div>

            <div className="mt-7">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-400">Interview progress</span>
                <span className="font-medium text-white">
                  {completedCount}/{questionCount}
                </span>
              </div>

              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"
                role="progressbar"
                aria-label="Interview progress"
                aria-valuemin={0}
                aria-valuemax={questionCount}
                aria-valuenow={completedCount}
              >
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {interview.status === "completed" ? (
              <div className="mt-8 space-y-6">
                <div className="grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6">
                    <p className="text-sm text-slate-400">
                      Overall practice score
                    </p>
                    <p className="mt-3 text-5xl font-bold text-cyan-400">
                      {interview.overallScore ?? 0}
                      <span className="text-xl font-medium text-slate-400">
                        /100
                      </span>
                    </p>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Average of your individual AI-generated answer scores.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 p-6">
                    <h3 className="font-semibold">Overall feedback</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {interview.summary ||
                        "Review the feedback for each answer to identify what to practise next."}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold">
                    Question-by-question review
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Review your answers, scores, strengths, and next steps.
                  </p>
                </div>

                {interview.questions.map((question, index) => (
                  <article
                    key={`${interview._id}-${index}`}
                    className="rounded-xl border border-slate-800 p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="text-sm font-medium text-cyan-400">
                        Question {index + 1}
                      </p>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold">
                        {question.score ?? 0}/100
                      </span>
                    </div>

                    <h4 className="mt-3 text-lg font-semibold leading-7">
                      {question.question}
                    </h4>

                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Your answer
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                        {question.answer || "No answer recorded."}
                      </p>
                    </div>

                    <div className="mt-5 rounded-xl bg-slate-950 p-4">
                      <p className="text-sm font-semibold">AI feedback</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                        {question.feedback || "No feedback available."}
                      </p>
                    </div>

                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      <div>
                        <h5 className="font-semibold text-emerald-300">
                          Strengths
                        </h5>
                        {question.strengths.length > 0 ? (
                          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-400">
                            {question.strengths.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">
                            No strengths listed.
                          </p>
                        )}
                      </div>

                      <div>
                        <h5 className="font-semibold text-amber-300">
                          Areas to improve
                        </h5>
                        {question.improvements.length > 0 ? (
                          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-400">
                            {question.improvements.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">
                            No improvement suggestions listed.
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}

                <button
                  type="button"
                  onClick={startNewInterview}
                  className={primaryButtonClass}
                >
                  Practise another interview →
                </button>
              </div>
            ) : currentQuestion ? (
              <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
                <article className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-cyan-400">
                      Question {interview.currentQuestionIndex + 1} of{" "}
                      {interview.questions.length}
                    </p>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs capitalize text-slate-300">
                      {interview.difficulty}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-semibold leading-8 sm:text-2xl">
                    {currentQuestion.question}
                  </h3>

                  <form onSubmit={submitAnswer} className="mt-7">
                    <label
                      htmlFor="answer"
                      className="text-sm font-medium text-slate-300"
                    >
                      Your answer
                    </label>

                    <textarea
                      id="answer"
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      rows={9}
                      maxLength={5000}
                      required
                      placeholder="Explain your reasoning. Include a specific example where relevant..."
                      className={`${inputClass} resize-y leading-7`}
                    />

                    <div className="mt-2 flex justify-between gap-3 text-xs text-slate-500">
                      <span>Be clear, relevant, and specific.</span>
                      <span>{answer.length}/5000</span>
                    </div>

                    <button
                      type="submit"
                      disabled={working || !answer.trim()}
                      className={`${primaryButtonClass} mt-5 w-full`}
                    >
                      {working
                        ? "Evaluating your answer..."
                        : interview.currentQuestionIndex ===
                            interview.questions.length - 1
                          ? "Submit final answer"
                          : "Submit answer and continue"}
                    </button>

                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Your answer is sent to the AI service for evaluation and
                      saved to your interview session.
                    </p>
                  </form>
                </article>

                <aside className="h-fit rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-semibold">Interview tips</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    A structured answer is often easier to understand and
                    evaluate.
                  </p>

                  <div className="mt-5 space-y-4">
                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-semibold text-cyan-400">
                        1
                      </span>
                      <div>
                        <p className="font-medium">Answer directly</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          Make your main point clear before adding detail.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-semibold text-cyan-400">
                        2
                      </span>
                      <div>
                        <p className="font-medium">Use STAR for examples</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          Explain the Situation, Task, Action, and Result for
                          experience-based questions.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-semibold text-cyan-400">
                        3
                      </span>
                      <div>
                        <p className="font-medium">Explain your reasoning</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          For technical questions, describe how you reached
                          your solution.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-semibold text-cyan-400">
                        4
                      </span>
                      <div>
                        <p className="font-medium">Learn from feedback</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          Review suggestions and practise improving your
                          response.
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <p className="font-semibold">No unanswered question found</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  This session has no available next question. Return to your
                  history or start a new interview.
                </p>
                <button
                  type="button"
                  onClick={startNewInterview}
                  className={`${primaryButtonClass} mt-4`}
                >
                  Start a new interview
                </button>
              </div>
            )}
          </section>
        )}

        <footer className="mt-8 border-t border-slate-800 pt-5 text-center text-xs leading-6 text-slate-500">
          CareerPilot AI · Mock interview practice · AI-generated feedback is
          educational and is not a guarantee of interview or employment success.
        </footer>
      </div>
    </main>
  );
}
