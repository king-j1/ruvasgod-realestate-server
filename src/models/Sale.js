const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    salePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "GHS",
      trim: true,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed", "refunded"],
      default: "unpaid",
    },

    paymentReference: {
      type: String,
      default: null,
      trim: true,
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

    saleStatus: {
      type: String,
      enum: ["pending", "reserved", "completed", "cancelled", "failed", "refunded"],
      default: "pending",
    },

    ownershipStatus: {
      type: String,
      enum: ["pending_transfer", "transferred", "cancelled"],
      default: "pending_transfer",
    },

    paidAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

saleSchema.index({ user: 1, createdAt: -1 });
saleSchema.index({ vehicle: 1, createdAt: -1 });
saleSchema.index({ paymentReference: 1 });

module.exports = mongoose.model("Sale", saleSchema);
