"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Booking = {
  id: string;
  consultant: {
    id: string;
    name: string;
    title: string;
    expertise: string[];
  } | null;
  startAt: string;
  endAt: string;
  customerName: string;
  customerEmail: string;
  agenda: string;
  amountPaise: number;
  currency: string;
  status: string;
  paymentStatus: string;
  meetingUrl?: string | null;
  createdAt: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function statusStyle(status: string) {
  switch (status.toLowerCase()) {
    case "confirmed":
      return "bg-emerald-500/15 text-emerald-400";
    case "cancelled":
      return "bg-red-500/15 text-red-400";
    case "completed":
      return "bg-slate-700 text-slate-300";
    default:
      return "bg-amber-500/15 text-amber-400";
  }
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBookings() {
      try {
        const token = localStorage.getItem("careerpilot_token");

        if (!token) {
          if (active) {
            setError("Please log in to view your bookings.");
            setLoading(false);
          }
          return;
        }

        const response = await fetch(
          `${API_URL}/api/consultations/bookings`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message ||
              data.error ||
              `Unable to load bookings (HTTP ${response.status}).`
          );
        }

        if (active) {
          setBookings(Array.isArray(data.bookings) ? data.bookings : []);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading bookings."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBookings();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-sky-400">
              CAREERPILOT AI
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              My Bookings
            </h1>
            <p className="mt-2 text-slate-400">
              View your career consultation appointments and payment status.
            </p>
          </div>

          <Link
            href="/consultations"
            className="inline-flex w-fit items-center justify-center rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-400"
          >
            Book a consultation
          </Link>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-300">
            Loading your bookings...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="font-semibold text-red-400">
              Could not load bookings
            </h2>
            <p className="mt-2 break-words text-sm text-slate-300">{error}</p>
            <p className="mt-3 text-sm text-slate-400">
              Check that you are logged in and that the backend is running.
            </p>
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10 text-2xl">
              📅
            </div>
            <h2 className="text-xl font-semibold">No bookings yet</h2>
            <p className="mx-auto mt-2 max-w-md text-slate-400">
              Your consultation appointments will appear here after you book
              them.
            </p>
            <Link
              href="/consultations"
              className="mt-6 inline-flex rounded-xl bg-sky-500 px-5 py-3 font-semibold hover:bg-sky-400"
            >
              Explore consultants
            </Link>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div className="space-y-5">
            <div className="text-sm text-slate-400">
              {bookings.length} booking{bookings.length === 1 ? "" : "s"} found
            </div>

            {bookings.map((booking) => (
              <article
                key={booking.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10 sm:p-7"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {booking.consultant?.name || "Career Consultant"}
                    </h2>
                    <p className="mt-1 text-sm text-sky-400">
                      {booking.consultant?.title || "Career Consultation"}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(
                      booking.status
                    )}`}
                  >
                    {booking.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Appointment date
                    </p>
                    <p className="mt-2 font-medium">
                      {formatDate(booking.startAt)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Appointment time
                    </p>
                    <p className="mt-2 font-medium">
                      {formatTime(booking.startAt)} –{" "}
                      {formatTime(booking.endAt)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Consultation fee
                    </p>
                    <p className="mt-2 font-semibold text-white">
                      {formatPrice(booking.amountPaise)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Payment status
                    </p>
                    <p
                      className={`mt-2 font-semibold ${
                        booking.paymentStatus === "paid"
                          ? "text-emerald-400"
                          : booking.paymentStatus === "failed"
                            ? "text-red-400"
                            : "text-amber-400"
                      }`}
                    >
                      {booking.paymentStatus.replaceAll("_", " ")}
                    </p>
                  </div>
                </div>

                {booking.consultant?.expertise &&
                  booking.consultant.expertise.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-sm text-slate-400">Expertise</p>
                      <div className="flex flex-wrap gap-2">
                        {booking.consultant.expertise.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {booking.agenda && (
                  <div className="mt-5">
                    <p className="mb-2 text-sm text-slate-400">
                      Your consultation goals
                    </p>
                    <p className="whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                      {booking.agenda}
                    </p>
                  </div>
                )}

                {booking.meetingUrl && booking.status === "confirmed" && (
                  <a
                    href={booking.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500"
                  >
                    Join consultation
                  </a>
                )}

                <p className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">
                  Booking reference: {booking.id}
                </p>
              </article>
            ))}
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 transition hover:text-sky-400"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}