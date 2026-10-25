
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type ProfileResponse = {
  success: boolean;
  user: {
    id: string;
    role: string;
  };
};

type DashboardCard = {
  title: string;
  description: string;
  href: string | null;
  available: boolean;
};

const cards: DashboardCard[] = [
  {
    title: "AI Career Chat",
    description:
      "Get personalized guidance for your next career move, skills, and job search.",
    href: "/chat",
    available: true,
  },
  {
    title: "Resume Assistant",
    description:
      "Analyze your existing resume and receive AI-powered feedback and improvement suggestions.",
    href: "/resume",
    available: true,
  },
  {
    title: "Resume Builder",
    description:
      "Create a professional resume, preview it live, and download it as a PDF.",
    href: "/resume-builder",
    available: true,
  },
  {
    title: "AI Mock Interview",
    description:
      "Practise role-specific interview questions, get AI feedback, and review your performance.",
    href: "/mock-interview",
    available: true,
  },
  {
    title: "Consultations",
    description:
      "Explore career consultants, available appointment times, and booking options.",
    href: "/consultations",
    available: true,
  },
  {
    title: "My Bookings",
    description:
      "View your consultation appointments, booking details, and payment status.",
    href: "/my-bookings",
    available: true,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const token = localStorage.getItem("careerpilot_token");

      if (!token) {
        router.replace("/");
        return;
      }

      try {
        const result = await apiRequest<ProfileResponse>("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!cancelled) {
          setUserId(result.user.id);
        }
      } catch {
        localStorage.removeItem("careerpilot_token");
        router.replace("/");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function logout() {
    localStorage.removeItem("careerpilot_token");
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Checking your session...
      </main>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-cyan-400">
              CAREERPILOT AI
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Your dashboard
            </h1>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-700 px-4 py-2 transition hover:bg-slate-800"
          >
            Sign out
          </button>
        </header>

        <p className="mt-4 text-slate-400">
          Welcome! Your account is authenticated.
        </p>

        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className={`flex flex-col rounded-xl border bg-slate-900 p-6 transition ${
                card.title === "AI Mock Interview"
                  ? "border-cyan-500/50 shadow-lg shadow-cyan-950/20 hover:border-cyan-400"
                  : "border-slate-800 hover:border-cyan-500/60"
              }`}
            >
              <h2 className="text-lg font-semibold">{card.title}</h2>

              <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">
                {card.description}
              </p>

              {card.available && card.href ? (
                <button
                  type="button"
                  onClick={() => router.push(card.href!)}
                  className="mt-6 w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Open {card.title} {"→"}
                </button>
              ) : (
                <p className="mt-6 text-sm font-medium text-cyan-400">
                  Coming soon
                </p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
