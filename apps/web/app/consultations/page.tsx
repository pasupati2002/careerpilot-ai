
"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

type Consultant = {
  id: string;
  name: string;
  title: string;
  expertise: string[];
  bio: string;
  feePaise: number;
  durationMinutes: number;
};

type Slot = {
  time: string;
  label?: string;
  startAt?: string;
  endAt?: string;
};

type ApiResult = {
  success?: boolean;
  message?: string;
  error?: string;
  consultants?: unknown[];
  availableSlots?: unknown[];
  slots?: unknown[];
  timezone?: string;
  durationMinutes?: number;
  booking?: Record<string, unknown>;
  keyId?: string;
  bookingId?: string;
  order?: {
    id: string;
    amount: number;
    currency: string;
  };
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
};

function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return time;

  const [hour, minute] = match.slice(1).map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatDate(date: string) {
  if (!date) return "";

  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) return "";

  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("careerpilot_token")
      : null;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  let data: ApiResult;

  try {
    data = (await response.json()) as ApiResult;
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok || data.success === false) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Your session may have expired. Please sign in again.");
    }

    throw new Error(
      data.message || data.error || `Request failed (${response.status}).`
    );
  }

  return data;
}

function normalizeConsultant(item: Record<string, unknown>): Consultant {
  return {
    id: String(item.id ?? item._id ?? ""),
    name: String(item.name ?? "Consultant"),
    title: String(item.title ?? "Career Consultant"),
    expertise: Array.isArray(item.expertise)
      ? item.expertise.map(String)
      : [],
    bio: String(item.bio ?? ""),
    feePaise: Number(item.feePaise ?? item.fee ?? 0),
    durationMinutes: Number(item.durationMinutes ?? 30),
  };
}

function normalizeSlot(item: unknown): Slot | null {
  if (typeof item === "string") {
    const match = item.match(/^(\d{1,2}:\d{2})/);
    return match ? { time: match[1] } : null;
  }

  if (typeof item !== "object" || item === null) {
    return null;
  }

  const slot = item as Record<string, unknown>;
  const rawTime = slot.time ?? slot.startTime ?? slot.start ?? slot.label;

  let time = "";

  if (typeof rawTime === "string") {
    const match = rawTime.match(/(\d{1,2}:\d{2})/);
    time = match?.[1] ?? "";
  }

  if (!time && typeof slot.startAt === "string") {
    const match = slot.startAt.match(/T(\d{2}:\d{2})/);
    time = match?.[1] ?? "";
  }

  if (!time) return null;

  return {
    time,
    label: typeof slot.label === "string" ? slot.label : undefined,
    startAt: typeof slot.startAt === "string" ? slot.startAt : undefined,
    endAt: typeof slot.endAt === "string" ? slot.endAt : undefined,
  };
}

export default function ConsultationsPage() {
  const [today, setToday] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [agenda, setAgenda] = useState("");

  const [loadingConsultants, setLoadingConsultants] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const selectedConsultant = consultants.find(
    (consultant) => consultant.id === selectedConsultantId
  );

  useEffect(() => {
    const now = new Date();
    const localToday = getLocalDateString(now);

    const lastDate = new Date(now);
    lastDate.setDate(lastDate.getDate() + 90);

    setToday(localToday);
    setMaxDate(getLocalDateString(lastDate));
    setSelectedDate(localToday);
  }, []);

  const loadConsultants = useCallback(async () => {
    setLoadingConsultants(true);
    setPageError("");

    try {
      const result = await apiRequest("/api/consultations/consultants");

      const items: unknown[] = Array.isArray(result.consultants)
        ? result.consultants
        : [];

      // FIX: Convert unknown API data to a record before normalizing it.
      // This avoids the invalid Record<string, unknown> type predicate.
      const normalized = items
        .filter(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            !Array.isArray(item)
        )
        .map((item) =>
          normalizeConsultant(item as Record<string, unknown>)
        )
        .filter((consultant) => consultant.id);

      setConsultants(normalized);

      setSelectedConsultantId((current) => {
        if (normalized.some((item) => item.id === current)) {
          return current;
        }

        return normalized[0]?.id ?? "";
      });

      if (normalized.length === 0) {
        setPageError("No consultants are currently available.");
      }
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Could not load consultants."
      );
    } finally {
      setLoadingConsultants(false);
    }
  }, []);

  const loadSlots = useCallback(async () => {
    if (!selectedConsultantId || !selectedDate) {
      setSlots([]);
      setSelectedTime("");
      return;
    }

    setLoadingSlots(true);
    setPageError("");
    setPageMessage("");
    setSlots([]);
    setSelectedTime("");

    try {
      const params = new URLSearchParams({
        consultantId: selectedConsultantId,
        date: selectedDate,
      });

      const result = await apiRequest(
        `/api/consultations/availability?${params.toString()}`
      );

      const rawSlots = Array.isArray(result.availableSlots)
        ? result.availableSlots
        : Array.isArray(result.slots)
          ? result.slots
          : [];

      const normalizedSlots = rawSlots
        .map(normalizeSlot)
        .filter((slot): slot is Slot => slot !== null)
        .filter(
          (slot, index, array) =>
            array.findIndex((item) => item.time === slot.time) === index
        )
        .sort((a, b) => a.time.localeCompare(b.time));

      setSlots(normalizedSlots);

      if (normalizedSlots.length === 0) {
        setPageMessage(
          "No appointment times are available for this date. Please choose another date."
        );
      }
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not load available times."
      );
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedConsultantId, selectedDate]);

  useEffect(() => {
    void loadConsultants();
  }, [loadConsultants]);

  useEffect(() => {
    if (!selectedDate) return;
    void loadSlots();
  }, [loadSlots, selectedDate]);

  function changeConsultant(id: string) {
    setSelectedConsultantId(id);
    setSelectedTime("");
    setPageError("");
    setPageMessage("");
  }

  function changeDate(date: string) {
    setSelectedDate(date);
    setSelectedTime("");
    setPageError("");
    setPageMessage("");
  }

  async function loadRazorpayScript(): Promise<boolean> {
    if (window.Razorpay) return true;

    return new Promise((resolve) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existing) {
        if (window.Razorpay) {
          resolve(true);
          return;
        }

        existing.addEventListener(
          "load",
          () => resolve(Boolean(window.Razorpay)),
          { once: true }
        );
        existing.addEventListener("error", () => resolve(false), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  }

  async function startPayment() {
    setPageError("");
    setPageMessage("");

    if (!selectedConsultant) {
      setPageError("Please select a consultant.");
      return;
    }

    if (!selectedDate || !selectedTime) {
      setPageError("Please choose an appointment date and time.");
      return;
    }

    if (!customerName.trim()) {
      setPageError("Please enter your full name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setPageError("Please enter a valid email address.");
      return;
    }

    if (!customerPhone.trim()) {
      setPageError("Please enter your phone number.");
      return;
    }

    if (!agenda.trim()) {
      setPageError("Please tell the consultant what you need help with.");
      return;
    }

    const [year, month, day] = selectedDate.split("-").map(Number);
    const [hour, minute] = selectedTime.split(":").map(Number);

    const appointmentStart = new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
      0
    );

    if (Number.isNaN(appointmentStart.getTime())) {
      setPageError("The selected appointment date or time is invalid.");
      return;
    }

    if (appointmentStart.getTime() <= Date.now()) {
      setPageError("Please select a future appointment time.");
      return;
    }

    setProcessingPayment(true);

    try {
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Could not load Razorpay Checkout. Check your internet connection and try again."
        );
      }

      const bookingResult = await apiRequest(
        "/api/consultations/bookings",
        {
          method: "POST",
          body: JSON.stringify({
            consultantId: selectedConsultant.id,
            date: selectedDate,
            time: selectedTime,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
            customerPhone: customerPhone.trim(),
            agenda: agenda.trim(),
          }),
        }
      );

      const booking = bookingResult.booking;
      const bookingId = String(
        booking?.id ?? booking?._id ?? bookingResult.bookingId ?? ""
      );

      if (!bookingId) {
        throw new Error(
          "The booking was created without a booking ID. Please refresh and check your bookings before trying again."
        );
      }

      const orderResult = await apiRequest(
        `/api/consultations/bookings/${encodeURIComponent(
          bookingId
        )}/payment-order`,
        { method: "POST" }
      );

      if (!orderResult.order?.id || !orderResult.keyId) {
        throw new Error(
          "The server did not return a valid Razorpay payment order. Check your Razorpay configuration."
        );
      }

      const options: Record<string, unknown> = {
        key: orderResult.keyId,
        amount: orderResult.order.amount,
        currency: orderResult.order.currency || "INR",
        name: "CareerPilot AI",
        description: `Career consultation with ${selectedConsultant.name}`,
        order_id: orderResult.order.id,
        prefill: {
          name: orderResult.customer?.name || customerName.trim(),
          email: orderResult.customer?.email || customerEmail.trim(),
          contact: orderResult.customer?.contact || customerPhone.trim(),
        },
        notes: {
          bookingId,
          consultant: selectedConsultant.name,
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
        },
        theme: { color: "#0ea5e9" },
        modal: {
          ondismiss: () => {
            setProcessingPayment(false);
            setPageMessage(
              "Payment window closed. Your booking may still be pending payment. Check your bookings before creating another one."
            );
          },
        },
        handler: async (paymentResponse: Record<string, string>) => {
          try {
            const verification = await apiRequest(
              `/api/consultations/bookings/${encodeURIComponent(
                bookingId
              )}/verify-payment`,
              {
                method: "POST",
                body: JSON.stringify({
                  razorpay_order_id: paymentResponse.razorpay_order_id,
                  razorpay_payment_id: paymentResponse.razorpay_payment_id,
                  razorpay_signature: paymentResponse.razorpay_signature,
                }),
              }
            );

            if (verification.success !== false) {
              setPageMessage(
                "Payment verified! Your consultation booking has been submitted successfully."
              );
              setSelectedTime("");
              await loadSlots();
            } else {
              throw new Error(
                verification.message || "Payment verification failed."
              );
            }
          } catch (error) {
            setPageError(
              error instanceof Error
                ? error.message
                : "Payment verification failed. Please check your booking status."
            );
          } finally {
            setProcessingPayment(false);
          }
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.open();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not start the booking or payment process."
      );
      setProcessingPayment(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
       <header className="mb-8">
  <div className="mb-5">
    <a
      href="/dashboard"
      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-400 hover:bg-slate-800"
    >
      <span aria-hidden="true">←</span>
      Back to Dashboard
    </a>
  </div>

  <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
    CareerPilot AI
  </p>

  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
    Book a Career Consultation
  </h1>

  <p className="mt-3 max-w-2xl text-slate-400">
    Meet with a career expert to discuss your resume, interview
    preparation, career transition, and professional goals.
  </p>
</header>

        {pageError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {pageError}
          </div>
        )}

        {pageMessage && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-200"
          >
            {pageMessage}
          </div>
        )}

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                1. Choose your consultant
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Select the expert who best matches your goals.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadConsultants()}
              disabled={loadingConsultants}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingConsultants ? "Loading..." : "Refresh consultants"}
            </button>
          </div>

          {loadingConsultants ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
              Loading consultants...
            </div>
          ) : consultants.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
              No consultants are available right now. Please try refreshing.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {consultants.map((consultant) => {
                const isSelected =
                  selectedConsultantId === consultant.id;

                return (
                  <button
                    key={consultant.id}
                    type="button"
                    onClick={() => changeConsultant(consultant.id)}
                    aria-pressed={isSelected}
                    className={`rounded-2xl border p-5 text-left transition ${
                      isSelected
                        ? "border-sky-400 bg-sky-500/10 ring-1 ring-sky-400/40"
                        : "border-slate-800 bg-slate-900 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-lg font-bold text-sky-300">
                        {consultant.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isSelected
                            ? "bg-sky-400/15 text-sky-300"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold">
                      {consultant.name}
                    </h3>
                    <p className="mt-1 text-sm text-sky-300">
                      {consultant.title}
                    </p>
                    <p className="mt-3 min-h-12 text-sm leading-6 text-slate-400">
                      {consultant.bio}
                    </p>

                    {consultant.expertise.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {consultant.expertise.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
                      <span className="text-sm text-slate-400">
                        {consultant.durationMinutes} minutes
                      </span>
                      <span className="text-lg font-bold text-white">
                        ₹
                        {(consultant.feePaise / 100).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">
              2. Select date and time
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Choose an available appointment slot. Times are displayed in
              the server&apos;s configured local timezone.
            </p>

            <div className="mt-6">
              <label
                htmlFor="appointment-date"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Appointment date
              </label>
              <input
                id="appointment-date"
                type="date"
                value={selectedDate}
                min={today}
                max={maxDate}
                onChange={(event) => changeDate(event.target.value)}
                disabled={!today}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50"
              />
              <p className="mt-2 text-xs text-slate-500">
                {formatDate(selectedDate)}
              </p>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-slate-200">
                  Available time slots
                </label>
                <button
                  type="button"
                  onClick={() => void loadSlots()}
                  disabled={
                    loadingSlots ||
                    !selectedConsultantId ||
                    !selectedDate
                  }
                  className="text-sm text-sky-300 hover:text-sky-200 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {loadingSlots ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-center text-sm text-slate-400">
                  Checking available times...
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm leading-6 text-slate-400">
                  No available slots for this date. Try another date or
                  consultant.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {slots.map((slot) => {
                    const isSelected = selectedTime === slot.time;

                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setSelectedTime(slot.time)}
                        aria-pressed={isSelected}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                          isSelected
                            ? "border-sky-400 bg-sky-500 text-white"
                            : "border-slate-700 bg-slate-950 text-slate-200 hover:border-sky-400"
                        }`}
                      >
                        {slot.label || formatTime(slot.time)}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedTime && (
                <p className="mt-4 rounded-xl bg-sky-500/10 p-3 text-sm text-sky-200">
                  Selected: {formatDate(selectedDate)} at{" "}
                  {formatTime(selectedTime)}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">
              3. Your booking details
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Enter your contact information so the consultation can be
              associated with your booking.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="customer-name"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Full name
                </label>
                <input
                  id="customer-name"
                  type="text"
                  autoComplete="name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Enter your full name"
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              <div>
                <label
                  htmlFor="customer-email"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Email address
                </label>
                <input
                  id="customer-email"
                  type="email"
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  placeholder="you@example.com"
                  maxLength={254}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              <div>
                <label
                  htmlFor="customer-phone"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Phone number
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="Enter your phone number"
                  maxLength={20}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              <div>
                <label
                  htmlFor="booking-agenda"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  What would you like help with?
                </label>
                <textarea
                  id="booking-agenda"
                  value={agenda}
                  onChange={(event) => setAgenda(event.target.value)}
                  placeholder="For example: resume review, interview preparation, or career change advice..."
                  rows={4}
                  maxLength={2000}
                  className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">
                    {selectedConsultant?.name || "Select a consultant"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedConsultant
                      ? `${selectedConsultant.durationMinutes}-minute consultation`
                      : "Choose an expert above"}
                  </p>
                  {selectedTime && (
                    <p className="mt-2 text-sm text-sky-300">
                      {selectedDate} · {formatTime(selectedTime)}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-xl font-bold text-white">
                  {selectedConsultant
                    ? `₹${(
                        selectedConsultant.feePaise / 100
                      ).toLocaleString("en-IN")}`
                    : "—"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void startPayment()}
              disabled={
                processingPayment ||
                loadingConsultants ||
                !selectedConsultant ||
                !selectedDate ||
                !selectedTime
              }
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-sky-500 px-5 py-3.5 font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processingPayment
                ? "Processing..."
                : "Book consultation and pay"}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Your appointment is subject to successful payment verification.
              Do not refresh the page while payment is processing.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
