
import mongoose, { Schema } from "mongoose";

const bookingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    consultantId: {
      type: Schema.Types.ObjectId,
      ref: "Consultant",
      required: true,
    },

    startAt: {
      type: Date,
      required: true,
    },

    endAt: {
      type: Date,
      required: true,
    },

    customerName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    customerPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },

    agenda: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 2000,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["inr"],
      default: "inr",
    },

    status: {
      type: String,
      enum: [
        "pending_payment",
        "confirmed",
        "cancelled",
        "completed",
      ],
      default: "pending_payment",
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    slotActive: {
      type: Boolean,
      default: true,
    },

    // Retained for compatibility with any existing Stripe-related code.
    stripeSessionId: {
      type: String,
      default: null,
    },

    // Razorpay order created by the backend.
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },

    // Razorpay payment identifier returned after checkout.
    razorpayPaymentId: {
      type: String,
      default: null,
    },

    // Signature returned by Razorpay Checkout.
    // The backend must verify it before confirming payment.
    razorpaySignature: {
      type: String,
      default: null,
    },

    calendarEventId: {
      type: String,
      default: null,
    },

    meetingUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent two active bookings with the same consultant and start time.
// The availability controller must also check overlapping time ranges.
bookingSchema.index(
  { consultantId: 1, startAt: 1 },
  {
    unique: true,
    partialFilterExpression: { slotActive: true },
  }
);

bookingSchema.index({ userId: 1, createdAt: -1 });

bookingSchema.index({
  consultantId: 1,
  startAt: 1,
  status: 1,
});

export const Booking = mongoose.model("Booking", bookingSchema);
