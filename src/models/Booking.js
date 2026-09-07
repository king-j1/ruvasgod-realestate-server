const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    // The customer making the booking
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The vehicle being rented
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    // Rental start date
    startDate: {
      type: Date,
      required: true,
    },

    // Rental end date
    endDate: {
      type: Date,
      required: true,
    },

    // Total rental cost
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Booking status
    status: {
      type: String,
     enum: [
  "pending",
  "confirmed",
  "active",
  "completed",
  "overdue",
  "cancelled",
],
      default: "pending",
    },

    // Payment status
    paymentStatus: {
      type: String,
      enum: [
        "unpaid",
        "pending",
        "paid",
        "failed",
        "refunded",
      ],
      default: "unpaid",
    },

    // Payment reference from the payment provider
    paymentReference: {
      type: String,
      default: null,
    },

    refundStatus: {
      type: String,
      enum: [
        "not_requested",
        "pending",
        "processing",
        "refunded",
        "failed",
        "needs_attention",
      ],
      default: "not_requested",
    },

    refundRequestedAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    refundReference: {
      type: String,
      default: null,
      trim: true,
    },

    refundError: {
      type: String,
      default: null,
      trim: true,
    },

    holdExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Booking", bookingSchema);