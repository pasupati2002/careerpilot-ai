
import type { Request, Response } from "express";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Booking } from "./booking.model.js";
import { Consultant } from "./consultant.model.js";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

function safeStringEqual(expected: Buffer, suppliedHex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) {
    return false;
  }

  const supplied = Buffer.from(suppliedHex, "hex");

  return (
    supplied.length === expected.length &&
    timingSafeEqual(expected, supplied)
  );
}

export async function listConsultants(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const consultants = await Consultant.find({ isActive: true })
      .select("name title expertise bio feePaise durationMinutes")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      consultants: consultants.map((consultant) => ({
        id: consultant._id.toString(),
        name: consultant.name,
        title: consultant.title,
        expertise: consultant.expertise,
        bio: consultant.bio,
        feePaise: consultant.feePaise,
        durationMinutes: consultant.durationMinutes,
      })),
    });
  } catch (error: unknown) {
    console.error("List consultants error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load consultants right now.",
    });
  }
}

/**
 * Returns the authenticated user's consultation bookings.
 * The user ID comes from authentication, never from the request body.
 */
export async function listMyBookings(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!isValidObjectId(userId)) {
      res.status(401).json({
        success: false,
        message: "Please log in to view your bookings.",
      });
      return;
    }

    const bookings = await Booking.find({ userId })
      .populate({
        path: "consultantId",
        select: "name title expertise",
      })
      .sort({ startAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      bookings: bookings.map((booking) => {
        const consultant = booking.consultantId as unknown as {
          _id?: mongoose.Types.ObjectId;
          name?: string;
          title?: string;
          expertise?: string[];
        } | null;

        return {
          id: booking._id.toString(),
          consultant: consultant
            ? {
                id: consultant._id?.toString() ?? "",
                name: consultant.name ?? "Consultant",
                title: consultant.title ?? "Career Consultant",
                expertise: consultant.expertise ?? [],
              }
            : null,
          startAt: booking.startAt,
          endAt: booking.endAt,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          agenda: booking.agenda,
          amountPaise: booking.amountPaise,
          currency: booking.currency,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          meetingUrl: booking.meetingUrl,
          createdAt: booking.createdAt,
        };
      }),
    });
  } catch (error: unknown) {
    console.error("List my bookings error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load your bookings right now.",
    });
  }
}

export async function getAvailability(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { consultantId, date } = req.query;

    if (
      !isValidObjectId(consultantId) ||
      typeof date !== "string" ||
      !isValidDateString(date)
    ) {
      res.status(400).json({
        success: false,
        message: "A valid consultant ID and date are required.",
      });
      return;
    }

    const [year, month, day] = date.split("-").map(Number);

    // Appointment dates use the server's local timezone.
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    const closingTime = new Date(year, month - 1, day, 17, 0, 0, 0);

    const consultant = await Consultant.findOne({
      _id: consultantId,
      isActive: true,
    }).lean();

    if (!consultant) {
      res.status(404).json({
        success: false,
        message: "The selected consultant was not found.",
      });
      return;
    }

    const bookings = await Booking.find({
      consultantId: consultant._id,
      slotActive: true,
      startAt: { $lt: dayEnd },
      endAt: { $gt: dayStart },
    })
      .select("startAt endAt")
      .lean();

    const now = new Date();
    const availableSlots: string[] = [];
    const openingMinutes = 9 * 60;
    const closingMinutes = 17 * 60;

    for (
      let startMinutes = openingMinutes;
      startMinutes < closingMinutes;
      startMinutes += 30
    ) {
      const hours = Math.floor(startMinutes / 60);
      const minutes = startMinutes % 60;

      const startAt = new Date(
        year,
        month - 1,
        day,
        hours,
        minutes,
        0,
        0
      );

      const endAt = new Date(
        startAt.getTime() + consultant.durationMinutes * 60 * 1000
      );

      if (startAt.getTime() <= now.getTime()) {
        continue;
      }

      if (endAt.getTime() > closingTime.getTime()) {
        continue;
      }

      const overlaps = bookings.some((booking) => {
        const bookingStart = new Date(booking.startAt).getTime();
        const bookingEnd = new Date(booking.endAt).getTime();

        return (
          startAt.getTime() < bookingEnd &&
          endAt.getTime() > bookingStart
        );
      });

      if (!overlaps) {
        availableSlots.push(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
        );
      }
    }

    if (availableSlots.length === 0) {
      console.warn("No consultation slots available:", {
        requestedDate: date,
        serverTime: now.toString(),
        serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dayStart: dayStart.toString(),
        dayEnd: dayEnd.toString(),
        consultantId,
        consultantDurationMinutes: consultant.durationMinutes,
        overlappingActiveBookings: bookings.length,
      });
    }

    res.status(200).json({
      success: true,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "server-local",
      durationMinutes: consultant.durationMinutes,
      availableSlots,
    });
  } catch (error: unknown) {
    console.error("Get availability error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load availability right now.",
    });
  }
}

export async function createBooking(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!isValidObjectId(userId)) {
      res.status(401).json({
        success: false,
        message: "Please log in to create a booking.",
      });
      return;
    }

    const {
      consultantId,
      date,
      time,
      customerName,
      customerEmail,
      customerPhone,
      agenda,
    } = req.body ?? {};

    if (
      !isValidObjectId(consultantId) ||
      typeof date !== "string" ||
      !isValidDateString(date) ||
      typeof time !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      typeof customerName !== "string" ||
      typeof customerEmail !== "string" ||
      typeof customerPhone !== "string" ||
      typeof agenda !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide valid booking details.",
      });
      return;
    }

    const name = customerName.trim();
    const email = customerEmail.trim().toLowerCase();
    const phone = customerPhone.trim();
    const consultationAgenda = agenda.trim();

    if (
      name.length < 2 ||
      name.length > 100 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phone.length < 7 ||
      phone.length > 30 ||
      consultationAgenda.length < 5 ||
      consultationAgenda.length > 2000
    ) {
      res.status(400).json({
        success: false,
        message: "Please check your name, email, phone, and agenda.",
      });
      return;
    }

    const consultant = await Consultant.findOne({
      _id: consultantId,
      isActive: true,
    });

    if (!consultant) {
      res.status(404).json({
        success: false,
        message: "The selected consultant is unavailable.",
      });
      return;
    }

    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);

    const startAt = new Date(year, month - 1, day, hours, minutes, 0, 0);

    if (
      startAt.getFullYear() !== year ||
      startAt.getMonth() !== month - 1 ||
      startAt.getDate() !== day ||
      startAt.getHours() !== hours ||
      startAt.getMinutes() !== minutes
    ) {
      res.status(400).json({
        success: false,
        message: "The selected date or time is invalid.",
      });
      return;
    }

    const endAt = new Date(
      startAt.getTime() + consultant.durationMinutes * 60 * 1000
    );

    if (startAt.getTime() <= Date.now()) {
      res.status(400).json({
        success: false,
        message: "Please select a future appointment time.",
      });
      return;
    }

    const startMinutes = hours * 60 + minutes;
    const openingMinutes = 9 * 60;
    const closingMinutes = 17 * 60;
    const closingTime = new Date(year, month - 1, day, 17, 0, 0, 0);

    if (
      startMinutes < openingMinutes ||
      startMinutes >= closingMinutes ||
      (startMinutes - openingMinutes) % 30 !== 0 ||
      endAt.getTime() > closingTime.getTime()
    ) {
      res.status(400).json({
        success: false,
        message: "Please select a valid available appointment slot.",
      });
      return;
    }

    const existingBooking = await Booking.findOne({
      consultantId: consultant._id,
      slotActive: true,
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    }).select("_id");

    if (existingBooking) {
      res.status(409).json({
        success: false,
        message:
          "This appointment overlaps with an existing booking. Please choose another time.",
      });
      return;
    }

    const booking = await Booking.create({
      userId,
      consultantId: consultant._id,
      startAt,
      endAt,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      agenda: consultationAgenda,
      amountPaise: consultant.feePaise,
      currency: "inr",
      status: "pending_payment",
      paymentStatus: "pending",
      slotActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Booking created. Payment is required to confirm it.",
      booking: {
        id: booking._id.toString(),
        consultantId: consultant._id.toString(),
        consultantName: consultant.name,
        date,
        time,
        startAt: booking.startAt,
        endAt: booking.endAt,
        durationMinutes: consultant.durationMinutes,
        amountPaise: booking.amountPaise,
        currency: booking.currency,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message:
          "This appointment has just been booked. Please choose another time.",
      });
      return;
    }

    console.error("Create booking error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create the booking right now.",
    });
  }
}

export async function createPaymentOrder(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    const bookingId = req.params.bookingId;

    if (!isValidObjectId(userId)) {
      res.status(401).json({
        success: false,
        message: "Please log in to continue with payment.",
      });
      return;
    }

    if (!isValidObjectId(bookingId)) {
      res.status(400).json({
        success: false,
        message: "A valid booking ID is required.",
      });
      return;
    }

    const razorpay = getRazorpayClient();

    if (!razorpay) {
      res.status(503).json({
        success: false,
        message: "Payment service is not configured.",
      });
      return;
    }

    const booking = await Booking.findOne({ _id: bookingId, userId });

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
      return;
    }

    if (
      booking.status !== "pending_payment" ||
      booking.paymentStatus !== "pending" ||
      !booking.slotActive
    ) {
      res.status(409).json({
        success: false,
        message: "This booking is not available for payment.",
      });
      return;
    }

    if (booking.startAt.getTime() <= Date.now()) {
      res.status(400).json({
        success: false,
        message: "Payment cannot be initiated for a past appointment.",
      });
      return;
    }

    if (
      !Number.isSafeInteger(booking.amountPaise) ||
      booking.amountPaise <= 0 ||
      booking.currency.toLowerCase() !== "inr"
    ) {
      res.status(400).json({
        success: false,
        message: "The booking amount is invalid.",
      });
      return;
    }

    const keyId = process.env.RAZORPAY_KEY_ID!;

    if (booking.razorpayOrderId) {
      const existingOrder = await razorpay.orders.fetch(
        booking.razorpayOrderId
      );

      if (
        existingOrder.status === "created" &&
        Number(existingOrder.amount) === booking.amountPaise &&
        existingOrder.currency.toUpperCase() === "INR"
      ) {
        res.status(200).json({
          success: true,
          keyId,
          bookingId: booking._id.toString(),
          order: {
            id: existingOrder.id,
            amount: Number(existingOrder.amount),
            currency: existingOrder.currency,
          },
          customer: {
            name: booking.customerName,
            email: booking.customerEmail,
            contact: booking.customerPhone,
          },
        });
        return;
      }

      res.status(409).json({
        success: false,
        message:
          "The existing payment order is no longer payable. Please contact support before retrying.",
      });
      return;
    }

    const order = await razorpay.orders.create({
      amount: booking.amountPaise,
      currency: "INR",
      receipt: booking._id.toString(),
      notes: {
        bookingId: booking._id.toString(),
        userId: booking.userId.toString(),
      },
    });

    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        userId,
        status: "pending_payment",
        paymentStatus: "pending",
        slotActive: true,
        razorpayOrderId: null,
      },
      { $set: { razorpayOrderId: order.id } },
      { new: true }
    );

    if (!updatedBooking) {
      res.status(409).json({
        success: false,
        message:
          "The payment order could not be attached to this booking. Please refresh and try again.",
      });
      return;
    }

    res.status(201).json({
      success: true,
      keyId,
      bookingId: booking._id.toString(),
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      customer: {
        name: booking.customerName,
        email: booking.customerEmail,
        contact: booking.customerPhone,
      },
    });
  } catch (error: unknown) {
    console.error("Create payment order error:", error);
    res.status(502).json({
      success: false,
      message: "Unable to create a payment order right now. Please try again.",
    });
  }
}

export async function verifyPayment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    const bookingId = req.params.bookingId;

    if (!isValidObjectId(userId)) {
      res.status(401).json({
        success: false,
        message: "Please log in to verify payment.",
      });
      return;
    }

    if (!isValidObjectId(bookingId)) {
      res.status(400).json({
        success: false,
        message: "A valid booking ID is required.",
      });
      return;
    }

    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body ?? {};

    if (
      typeof orderId !== "string" ||
      typeof paymentId !== "string" ||
      typeof signature !== "string" ||
      !orderId ||
      !paymentId ||
      !/^[a-f0-9]{64}$/i.test(signature)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid payment verification details.",
      });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      res.status(503).json({
        success: false,
        message: "Payment verification is not configured.",
      });
      return;
    }

    const booking = await Booking.findOne({ _id: bookingId, userId });

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
      return;
    }

    if (
      booking.paymentStatus === "paid" &&
      booking.status === "confirmed" &&
      booking.razorpayOrderId === orderId &&
      booking.razorpayPaymentId === paymentId
    ) {
      res.status(200).json({
        success: true,
        message: "Payment has already been verified.",
        booking: {
          id: booking._id.toString(),
          status: booking.status,
          paymentStatus: booking.paymentStatus,
        },
      });
      return;
    }

    if (
      booking.status !== "pending_payment" ||
      booking.paymentStatus !== "pending" ||
      !booking.slotActive ||
      booking.razorpayOrderId !== orderId
    ) {
      res.status(409).json({
        success: false,
        message: "This booking cannot be verified with that order.",
      });
      return;
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest();

    if (!safeStringEqual(expectedSignature, signature)) {
      res.status(400).json({
        success: false,
        message: "Payment signature verification failed.",
      });
      return;
    }

    const razorpay = getRazorpayClient();

    if (!razorpay) {
      res.status(503).json({
        success: false,
        message: "Payment service is not configured.",
      });
      return;
    }

    const payment = await razorpay.payments.fetch(paymentId);

    if (
      payment.order_id !== orderId ||
      Number(payment.amount) !== booking.amountPaise ||
      payment.currency.toUpperCase() !== "INR"
    ) {
      res.status(400).json({
        success: false,
        message: "Payment details do not match this booking.",
      });
      return;
    }

    if (payment.status !== "captured") {
      res.status(409).json({
        success: false,
        message:
          "Payment has not been captured yet. Your booking remains unconfirmed.",
      });
      return;
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        userId,
        razorpayOrderId: orderId,
        status: "pending_payment",
        paymentStatus: "pending",
        slotActive: true,
      },
      {
        $set: {
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          paymentStatus: "paid",
          status: "confirmed",
        },
      },
      { new: true }
    );

    if (!updatedBooking) {
      const latestBooking = await Booking.findOne({
        _id: booking._id,
        userId,
      });

      if (
        latestBooking?.paymentStatus === "paid" &&
        latestBooking.status === "confirmed" &&
        latestBooking.razorpayOrderId === orderId &&
        latestBooking.razorpayPaymentId === paymentId
      ) {
        res.status(200).json({
          success: true,
          message: "Payment has already been verified.",
          booking: {
            id: latestBooking._id.toString(),
            status: latestBooking.status,
            paymentStatus: latestBooking.paymentStatus,
          },
        });
        return;
      }

      res.status(409).json({
        success: false,
        message:
          "The booking could not be confirmed. If money was deducted, please contact support.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Payment verified and booking confirmed.",
      booking: {
        id: updatedBooking._id.toString(),
        status: updatedBooking.status,
        paymentStatus: updatedBooking.paymentStatus,
      },
    });
  } catch (error: unknown) {
    console.error("Verify payment error:", error);
    res.status(502).json({
      success: false,
      message:
        "Unable to verify payment right now. If money was deducted, do not pay again until the payment status is checked.",
    });
  }
}

/**
 * Razorpay webhook endpoint.
 * The route must pass the original raw request body to this handler.
 */
export async function handleRazorpayWebhook(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const rawBody: unknown = req.body;
    const signature = req.headers["x-razorpay-signature"];

    if (!secret) {
      res.status(503).json({
        success: false,
        message: "Webhook is not configured.",
      });
      return;
    }

    if (
      !Buffer.isBuffer(rawBody) ||
      typeof signature !== "string" ||
      !/^[a-f0-9]{64}$/i.test(signature)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid webhook request.",
      });
      return;
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(rawBody)
      .digest();

    if (!safeStringEqual(expectedSignature, signature)) {
      res.status(401).json({
        success: false,
        message: "Invalid webhook signature.",
      });
      return;
    }

    let event: {
      event?: unknown;
      payload?: {
        payment?: {
          entity?: Record<string, unknown>;
        };
      };
    };

    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).json({
        success: false,
        message: "Invalid webhook payload.",
      });
      return;
    }

    if (event.event !== "payment.captured") {
      res.status(200).json({
        success: true,
        message: "Event received.",
      });
      return;
    }

    const payment = event.payload?.payment?.entity;

    if (
      !payment ||
      typeof payment.id !== "string" ||
      typeof payment.order_id !== "string" ||
      typeof payment.amount !== "number" ||
      typeof payment.currency !== "string" ||
      payment.status !== "captured"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid captured payment details.",
      });
      return;
    }

    const booking = await Booking.findOne({
      razorpayOrderId: payment.order_id,
    });

    if (!booking) {
      console.error(
        "Captured Razorpay payment has no matching booking:",
        payment.order_id
      );

      res.status(200).json({
        success: true,
        message: "Event received.",
      });
      return;
    }

    if (
      Number(payment.amount) !== booking.amountPaise ||
      payment.currency.toUpperCase() !== "INR"
    ) {
      console.error(
        "Razorpay payment amount or currency mismatch for booking:",
        booking._id.toString()
      );

      res.status(200).json({
        success: true,
        message: "Event received.",
      });
      return;
    }

    if (
      booking.paymentStatus === "paid" &&
      booking.status === "confirmed" &&
      booking.razorpayPaymentId === payment.id
    ) {
      res.status(200).json({
        success: true,
        message: "Payment was already processed.",
      });
      return;
    }

    if (
      booking.status !== "pending_payment" ||
      booking.paymentStatus !== "pending" ||
      !booking.slotActive
    ) {
      console.error(
        "Captured payment needs reconciliation for booking:",
        booking._id.toString()
      );

      res.status(200).json({
        success: true,
        message: "Event received.",
      });
      return;
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        razorpayOrderId: payment.order_id,
        status: "pending_payment",
        paymentStatus: "pending",
        slotActive: true,
      },
      {
        $set: {
          razorpayPaymentId: payment.id,
          paymentStatus: "paid",
          status: "confirmed",
        },
      },
      { new: true }
    );

    if (!updatedBooking) {
      const latestBooking = await Booking.findById(booking._id);

      if (
        latestBooking?.paymentStatus === "paid" &&
        latestBooking.status === "confirmed" &&
        latestBooking.razorpayPaymentId === payment.id
      ) {
        res.status(200).json({
          success: true,
          message: "Payment was already processed.",
        });
        return;
      }

      console.error(
        "Captured payment needs reconciliation for booking:",
        booking._id.toString()
      );

      res.status(200).json({
        success: true,
        message: "Event received.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Payment captured and booking confirmed.",
    });
  } catch (error: unknown) {
    console.error("Razorpay webhook processing error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process webhook right now.",
    });
  }
}
