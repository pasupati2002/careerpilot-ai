
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  createBooking,
  createPaymentOrder,
  getAvailability,
  listConsultants,
  listMyBookings,
  verifyPayment,
} from "./consultations.controller.js";

const router = Router();

// All routes in this router require authentication.
router.use(requireAuth);

router.get("/consultants", listConsultants);
router.get("/availability", getAvailability);

// Returns bookings belonging to the currently authenticated user.
router.get("/bookings", listMyBookings);

// Creates a new consultation booking.
router.post("/bookings", createBooking);

// Razorpay payment flow.
router.post("/bookings/:bookingId/payment-order", createPaymentOrder);
router.post("/bookings/:bookingId/verify-payment", verifyPayment);

export default router;
