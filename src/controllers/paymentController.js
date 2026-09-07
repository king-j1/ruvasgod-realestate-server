const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Sale = require("../models/Sale");
const Vehicle = require("../models/Vehicle");
const {
  initializePayment,
  verifyPayment,
  requestRefund,
} = require("../services/paymentService");

const PENDING_HOLD_MS = 30 * 60 * 1000;

const getRefundStatus = (refundData) => {
  const status = refundData?.data?.status || refundData?.status;

  if (["refunded", "processed", "success"].includes(status)) {
    return "refunded";
  }

  if (["pending", "processing"].includes(status)) {
    return "processing";
  }

  if (["needs_attention", "needs-attention"].includes(status)) {
    return "needs_attention";
  }

  return "failed";
};

const expirePendingBookingHolds = async (session) => {
  await Booking.updateMany(
    {
      status: "pending",
      paymentStatus: { $in: ["unpaid", "pending"] },
      holdExpiresAt: { $lte: new Date() },
    },
    {
      $set: {
        status: "cancelled",
        paymentStatus: "failed",
      },
    },
    session ? { session } : undefined
  );
};

const completeExpiredPaidBookings = async (session) => {
  await Booking.updateMany(
    {
      status: { $in: ["confirmed", "active", "overdue"] },
      paymentStatus: "paid",
      endDate: { $lt: new Date() },
    },
    {
      $set: {
        status: "completed",
      },
    },
    { session }
  );
};

const conflictingRentalQuery = (vehicleId, now) => ({
  vehicle: vehicleId,
  $or: [
    {
      status: { $in: ["confirmed", "active", "overdue"] },
      paymentStatus: "paid",
    },
    {
      status: "pending",
      paymentStatus: { $in: ["unpaid", "pending"] },
      holdExpiresAt: { $gt: now },
    },
  ],
});

const requestBookingRefund = async (booking, reference) => {
  const refundClaim = await Booking.updateOne(
    {
      _id: booking._id,
      refundStatus: "not_requested",
    },
    {
      $set: {
        refundStatus: "pending",
        refundRequestedAt: new Date(),
      },
    }
  );

  if (refundClaim.modifiedCount === 0) {
    return Booking.findById(booking._id);
  }

  try {
    const refundResponse = await requestRefund(reference);
    const refundStatus = getRefundStatus(refundResponse);
    const refundUpdate = {
      refundStatus,
      refundReference:
        refundResponse?.data?.id?.toString() ||
        refundResponse?.data?.reference ||
        null,
      refundError:
        refundStatus === "failed" || refundStatus === "needs_attention"
          ? refundResponse?.message || "Paystack refund requires attention"
          : null,
    };

    if (refundStatus === "refunded") {
      refundUpdate.paymentStatus = "refunded";
      refundUpdate.refundedAt = new Date();
    }

    await Booking.updateOne(
      { _id: booking._id, refundStatus: "pending" },
      { $set: refundUpdate }
    );
  } catch (error) {
    await Booking.updateOne(
      { _id: booking._id, refundStatus: "pending" },
      {
        $set: {
          refundStatus: "needs_attention",
          refundError:
            error.response?.data?.message ||
            error.message ||
            "Paystack refund request failed",
        },
      }
    );
  }

  return Booking.findById(booking._id);
};

const rentalConflictMessage = (refundStatus) => {
  if (refundStatus === "refunded") {
    return "The rental could not be fulfilled. The payment was refunded.";
  }

  if (refundStatus === "processing") {
    return "The rental could not be fulfilled. The payment refund is processing.";
  }

  if (refundStatus === "needs_attention") {
    return "The rental could not be fulfilled. The payment refund requires attention.";
  }

  if (refundStatus === "failed") {
    return "The rental could not be fulfilled. The payment refund failed.";
  }

  return "The rental could not be fulfilled. The payment refund is being requested.";
};



// Initialize payment for a booking
const initializeBookingPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate("user")
      .populate("vehicle");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Customer can only pay for their own booking
    if (
      booking.user._id.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to pay for this booking",
      });
    }

    // Only pending bookings can be paid
    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending bookings can be paid for",
      });
    }

    // Don't allow payment twice
    if (booking.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This booking has already been paid for",
      });
    }

    // Convert GHS to pesewas
    const amount = Math.round(booking.totalPrice * 100);

    // Create unique payment reference
    const reference = `RUVA-${booking._id}-${Date.now()}`;

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      return res.status(500).json({
        success: false,
        message: "Payment callback URL is not configured",
      });
    }

    // Backend controls the callback URL
    const callback_url = `${frontendUrl}/payment/callback`;

    // Initialize payment with Paystack
    const payment = await initializePayment({
      email: booking.user.email,
      amount,
      reference,
      metadata: {
        bookingId: booking._id.toString(),
        userId: booking.user._id.toString(),
        vehicleId: booking.vehicle._id.toString(),
      },
      callback_url,
    });

    // Save payment reference
    booking.paymentReference = reference;
    booking.paymentStatus = "pending";
    booking.holdExpiresAt = new Date(Date.now() + PENDING_HOLD_MS);

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Payment initialized successfully",
      payment: {
        authorizationUrl:
          payment.data.authorization_url,
        accessCode:
          payment.data.access_code,
        reference:
          payment.data.reference,
      },
    });

  } catch (error) {
    console.error(
      "Initialize payment error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to initialize payment",
    });
  }
};

const finalizeBookingPayment = async ({ reference, transaction }) => {
  let booking = await Booking.findOne({
    paymentReference: reference,
  });

  if (!booking && transaction?.metadata?.bookingId) {
    booking = await Booking.findById(transaction.metadata.bookingId);
  }

  if (!booking) {
    return { notFound: true };
  }

  if (booking.paymentStatus === "paid" && booking.status === "confirmed") {
    return { success: true, alreadyPaid: true, booking };
  }

  if (
    booking.status === "cancelled" &&
    booking.refundStatus !== "not_requested"
  ) {
    return {
      success: false,
      conflict: true,
      refundStatus: booking.refundStatus,
      message: rentalConflictMessage(booking.refundStatus),
      booking,
    };
  }

  const session = await mongoose.startSession();
  let conflict = false;

  try {
    await session.withTransaction(async () => {
      await expirePendingBookingHolds(session);
      await completeExpiredPaidBookings(session);

      const currentBooking = await Booking.findById(booking._id).session(
        session
      );

      if (!currentBooking || currentBooking.status !== "pending") {
        conflict = true;

        if (currentBooking) {
          currentBooking.paymentReference = reference;
          currentBooking.paymentStatus = "paid";
          currentBooking.status = "cancelled";
          await currentBooking.save({ session });
          booking = currentBooking;
        }

        return;
      }

      if (
        currentBooking.holdExpiresAt &&
        currentBooking.holdExpiresAt <= new Date()
      ) {
        currentBooking.status = "cancelled";
        currentBooking.paymentReference = reference;
        currentBooking.paymentStatus = "paid";
        await currentBooking.save({ session });
        booking = currentBooking;
        conflict = true;
        return;
      }

      const completedSale = await Sale.findOne({
        vehicle: currentBooking.vehicle,
        saleStatus: "completed",
        ownershipStatus: "transferred",
      }).session(session);

      if (completedSale) {
        conflict = true;
        currentBooking.paymentReference = reference;
        currentBooking.paymentStatus = "paid";
        currentBooking.status = "cancelled";
        await currentBooking.save({ session });
        booking = currentBooking;
        return;
      }

      const vehicleUpdateResult = await Vehicle.updateOne(
        { _id: currentBooking.vehicle, availableForRent: true },
        { $inc: { availabilityVersion: 1 } },
        { session }
      );

      if (vehicleUpdateResult.matchedCount === 0) {
        conflict = true;
        currentBooking.paymentReference = reference;
        currentBooking.paymentStatus = "paid";
        currentBooking.status = "cancelled";
        await currentBooking.save({ session });
        booking = currentBooking;
        return;
      }

      currentBooking.paymentReference = reference;
      currentBooking.paymentStatus = "paid";
      currentBooking.status = "confirmed";
      currentBooking.holdExpiresAt = null;

      await currentBooking.save({ session });
      booking = currentBooking;
    });
  } finally {
    await session.endSession();
  }

  if (conflict) {
    booking = await requestBookingRefund(booking, reference);

    return {
      success: false,
      conflict: true,
      refundStatus: booking?.refundStatus,
      message: rentalConflictMessage(booking?.refundStatus),
      booking,
    };
  }

  return { success: true, booking };
};

// Verify Paystack payment
const verifyBookingPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required",
      });
    }

    // Ask Paystack to verify the transaction
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization:
            `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const transaction = response.data.data;

    // Payment was not successful
    if (transaction.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
        status: transaction.status,
      });
    }

    // Find booking using payment reference
    let booking = await Booking.findOne({
      paymentReference: reference,
    });

    // Fallback for older checkout links when a booking reference was later replaced.
    if (!booking && transaction?.metadata?.bookingId) {
      booking = await Booking.findById(
        transaction.metadata.bookingId
      );

      if (
        booking &&
        transaction?.metadata?.userId &&
        booking.user.toString() !==
          transaction.metadata.userId.toString()
      ) {
        return res.status(400).json({
          success: false,
          message: "Payment metadata does not match booking owner",
        });
      }
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking for this payment was not found",
      });
    }

    // Make sure customer owns the booking
    if (
      booking.user.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to verify this payment",
      });
    }

    const result = await finalizeBookingPayment({ reference, transaction });

    if (result.notFound) {
      return res.status(404).json({
        success: false,
        message: "Booking for this payment was not found",
      });
    }

    if (result.conflict) {
      return res.status(409).json({
        success: false,
        message: result.message,
        refundStatus: result.refundStatus,
      });
    }

    res.status(200).json({
      success: true,
      message: result.alreadyPaid
        ? "Payment was already processed"
        : "Payment verified successfully",
      booking: result.booking,
    });

  } catch (error) {
    console.error(
      "Verify payment error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error:
        error.response?.data ||
        error.message,
    });
  }
};

// Initialize payment for a vehicle sale
const initializeSalePayment = async (req, res) => {
  try {
    const { saleId } = req.body;

    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: "Sale ID is required",
      });
    }

    const sale = await Sale.findById(saleId)
      .populate("user")
      .populate("vehicle");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Customer can only pay for their own sale
    if (sale.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to pay for this sale",
      });
    }

    // Don't allow payment twice
    if (sale.paymentStatus === "paid" || sale.saleStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "This sale has already been paid for",
      });
    }

    // Reject sales that are no longer eligible for payment
    if (["cancelled", "failed", "refunded"].includes(sale.saleStatus)) {
      return res.status(400).json({
        success: false,
        message: "This sale is no longer eligible for payment",
      });
    }

    // Re-check the vehicle still exists and is still available for sale
    const vehicle = await Vehicle.findById(sale.vehicle._id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle for this sale was not found",
      });
    }

    if (!vehicle.availableForSale) {
      return res.status(400).json({
        success: false,
        message: "This vehicle is no longer available for sale",
      });
    }

    // Amount comes only from the server-side Sale record
    const amount = Math.round(sale.salePrice * 100);

    // Create unique payment reference, clearly separated from rental references
    const reference = `SALE-${sale._id}-${Date.now()}`;

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      return res.status(500).json({
        success: false,
        message: "Payment callback URL is not configured",
      });
    }

    const callback_url = `${frontendUrl}/payment/sale/callback`;

    const payment = await initializePayment({
      email: sale.user.email,
      amount,
      reference,
      metadata: {
        entityType: "sale",
        saleId: sale._id.toString(),
        userId: sale.user._id.toString(),
        vehicleId: vehicle._id.toString(),
      },
      callback_url,
    });

    // Save payment reference
    sale.paymentReference = reference;
    sale.paymentStatus = "pending";

    await sale.save();

    res.status(200).json({
      success: true,
      message: "Sale payment initialized successfully",
      payment: {
        authorizationUrl: payment.data.authorization_url,
        accessCode: payment.data.access_code,
        reference: payment.data.reference,
      },
    });
  } catch (error) {
    console.error("Initialize sale payment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to initialize sale payment",
    });
  }
};

// Shared, idempotent finalization used by both sale verification and the webhook.
// Atomically marks the vehicle unavailable only if it is still available for sale,
// preventing two customers from completing a purchase for the same vehicle.
const finalizeSalePayment = async ({ reference, transaction }) => {
  let sale = await Sale.findOne({ paymentReference: reference });

  // Fallback for older checkout links when a sale reference was later replaced.
  if (!sale && transaction?.metadata?.saleId) {
    sale = await Sale.findById(transaction.metadata.saleId);
  }

  if (!sale) {
    return { success: false, notFound: true };
  }

  // Already finalized successfully — idempotent no-op.
  if (sale.paymentStatus === "paid" && sale.saleStatus === "completed") {
    return { success: true, alreadyCompleted: true, sale };
  }

  // A losing sale already has a refund operation claimed or completed.
  if (sale.saleStatus === "failed" && sale.refundStatus !== "not_requested") {
    return { success: false, conflict: true, refundPending: true, sale };
  }

  const session = await mongoose.startSession();
  let conflict = false;

  try {
    await session.withTransaction(async () => {
      await expirePendingBookingHolds(session);
      await completeExpiredPaidBookings(session);

      const conflictingRental = await Booking.findOne(
        conflictingRentalQuery(sale.vehicle, new Date())
      ).session(session);

      if (conflictingRental) {
        conflict = true;

        sale.paymentReference = reference;
        sale.paymentStatus = "paid";
        sale.saleStatus = "failed";
        sale.ownershipStatus = "cancelled";
        sale.refundStatus = "pending";
        sale.refundRequestedAt = new Date();

        await sale.save({ session });
        return;
      }

      const vehicleUpdateResult = await Vehicle.updateOne(
        { _id: sale.vehicle, availableForSale: true },
        {
          $set: { availableForSale: false, availableForRent: false },
          $inc: { availabilityVersion: 1 },
        },
        { session }
      );

      if (vehicleUpdateResult.matchedCount === 0) {
        // Vehicle was already sold by another transaction. Fail safely.
        conflict = true;

        sale.paymentReference = reference;
        sale.paymentStatus = "paid";
        sale.saleStatus = "failed";
        sale.ownershipStatus = "cancelled";
        sale.refundStatus = "pending";
        sale.refundRequestedAt = new Date();

        await sale.save({ session });
        return;
      }

      sale.paymentReference = reference;
      sale.paymentStatus = "paid";
      sale.saleStatus = "completed";
      sale.ownershipStatus = "transferred";
      sale.paidAt = new Date();
      sale.completedAt = new Date();

      await sale.save({ session });
    });
  } finally {
    await session.endSession();
  }

  if (conflict) {
    let refundStatus = sale.refundStatus;

    if (sale.refundStatus === "pending") {
      try {
        const refundResponse = await requestRefund(reference);
        refundStatus = getRefundStatus(refundResponse);

        const refundUpdate = {
          refundStatus,
          refundReference:
            refundResponse?.data?.id?.toString() ||
            refundResponse?.data?.reference ||
            null,
          refundError:
            refundStatus === "failed" || refundStatus === "needs_attention"
              ? refundResponse?.message || "Paystack refund requires attention"
              : null,
        };

        if (refundStatus === "refunded") {
          refundUpdate.paymentStatus = "refunded";
          refundUpdate.refundedAt = new Date();
        }

        await Sale.updateOne(
          { _id: sale._id, refundStatus: "pending" },
          { $set: refundUpdate }
        );
      } catch (error) {
        refundStatus = "needs_attention";

        await Sale.updateOne(
          { _id: sale._id, refundStatus: "pending" },
          {
            $set: {
              refundStatus,
              refundError:
                error.response?.data?.message ||
                error.message ||
                "Paystack refund request failed",
            },
          }
        );
      }
    }

    sale.refundStatus = refundStatus;

    return {
      success: false,
      conflict: true,
      message:
        refundStatus === "refunded"
          ? "Vehicle is no longer available. The payment was refunded."
          : "Vehicle is no longer available. The payment refund is being processed or requires attention.",
      sale,
    };
  }

  return { success: true, sale };
};

// Verify Paystack payment for a vehicle sale
const verifySalePayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required",
      });
    }

    // Ask Paystack to verify the transaction — never trust the frontend alone
    const verification = await verifyPayment(reference);
    const transaction = verification.data;

    if (transaction.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
        status: transaction.status,
      });
    }

    let sale = await Sale.findOne({ paymentReference: reference });

    if (!sale && transaction?.metadata?.saleId) {
      sale = await Sale.findById(transaction.metadata.saleId);

      if (
        sale &&
        transaction?.metadata?.userId &&
        sale.user.toString() !== transaction.metadata.userId.toString()
      ) {
        return res.status(400).json({
          success: false,
          message: "Payment metadata does not match sale owner",
        });
      }
    }

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale for this payment was not found",
      });
    }

    // Make sure customer owns the sale
    if (sale.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to verify this payment",
      });
    }

    const result = await finalizeSalePayment({ reference, transaction });

    if (result.notFound) {
      return res.status(404).json({
        success: false,
        message: "Sale for this payment was not found",
      });
    }

    if (result.conflict) {
      return res.status(409).json({
        success: false,
        message: result.message,
        sale: result.sale,
      });
    }

    res.status(200).json({
      success: true,
      message: result.alreadyCompleted
        ? "Sale was already completed"
        : "Sale payment verified successfully",
      sale: result.sale,
    });
  } catch (error) {
    console.error("Verify sale payment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to verify sale payment",
      error: error.response?.data || error.message,
    });
  }
};

// Handle Paystack webhook
const handlePaystackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];

    // Make sure Paystack sent a signature
    if (!signature) {
      return res.status(401).json({
        success: false,
        message: "Missing Paystack signature",
      });
    }

    // Create our own signature using the Paystack secret key
    const hash = crypto
      .createHmac(
        "sha512",
        process.env.PAYSTACK_SECRET_KEY
      )
      .update(req.body)
      .digest("hex");

    // Compare Paystack's signature with ours
    if (hash !== signature) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack signature",
      });
    }

    const event = JSON.parse(req.body.toString());

    console.log(
      "Paystack webhook received:",
      event.event
    );

    // We only process successful charges
    if (event.event !== "charge.success") {
      return res.status(200).json({
        success: true,
        message: "Event received",
      });
    }

    const transaction = event.data;

    const reference = transaction.reference;

    // Route sale events to the sales finalization path; booking logic below is untouched.
    const isSaleEvent =
      transaction?.metadata?.entityType === "sale" ||
      (typeof reference === "string" && reference.startsWith("SALE-"));

    if (isSaleEvent) {
      const result = await finalizeSalePayment({ reference, transaction });

      if (result.notFound) {
        console.log("Sale not found for reference:", reference);
      }

      return res.status(200).json({
        success: true,
        message: result.conflict
          ? "Sale webhook processed with conflict"
          : "Sale webhook processed",
      });
    }

    // Find booking using payment reference
    let booking = await Booking.findOne({
      paymentReference: reference,
    });

    // Fallback for older checkout links when a booking reference was later replaced.
    if (!booking && transaction?.metadata?.bookingId) {
      booking = await Booking.findById(
        transaction.metadata.bookingId
      );

      if (
        booking &&
        transaction?.metadata?.userId &&
        booking.user.toString() !==
          transaction.metadata.userId.toString()
      ) {
        return res.status(200).json({
          success: true,
          message: "Metadata user mismatch",
        });
      }
    }

    if (!booking) {
      console.log(
        "Booking not found for reference:",
        reference
      );

      return res.status(200).json({
        success: true,
        message: "Booking not found",
      });
    }

    const result = await finalizeBookingPayment({ reference, transaction });

    if (result.notFound) {
      return res.status(200).json({
        success: true,
        message: "Booking not found",
      });
    }

    console.log(
      `Booking ${result.booking._id} payment finalization attempted`
    );

    res.status(200).json({
      success: true,
      message: result.conflict
        ? "Webhook processed with rental conflict"
        : result.alreadyPaid
          ? "Payment already processed"
          : "Webhook processed successfully",
    });

  } catch (error) {
    console.error(
      "Paystack webhook error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

module.exports = {
  initializeBookingPayment,
  verifyBookingPayment,
  handlePaystackWebhook,
  initializeSalePayment,
  verifySalePayment,
};