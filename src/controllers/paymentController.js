const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Sale = require("../models/Sale");
const Vehicle = require("../models/Vehicle");
const { initializePayment, verifyPayment } = require("../services/paymentService");



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

    // Mark payment and booking as successful
    booking.paymentReference = reference;
    booking.paymentStatus = "paid";
    booking.status = "confirmed";

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      booking,
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

  const session = await mongoose.startSession();
  let conflict = false;

  try {
    await session.withTransaction(async () => {
      const vehicleUpdateResult = await Vehicle.updateOne(
        { _id: sale.vehicle, availableForSale: true },
        { $set: { availableForSale: false, availableForRent: false } },
        { session }
      );

      if (vehicleUpdateResult.matchedCount === 0) {
        // Vehicle was already sold by another transaction. Fail safely.
        conflict = true;

        sale.paymentReference = reference;
        sale.paymentStatus = "paid";
        sale.saleStatus = "failed";
        sale.ownershipStatus = "cancelled";

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
    return {
      success: false,
      conflict: true,
      message:
        "Vehicle already sold to another customer. Payment was captured and requires manual refund.",
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

    // Prevent duplicate processing
    if (booking.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
      });
    }

    // Mark booking as paid
    booking.paymentReference = reference;
    booking.paymentStatus = "paid";
    booking.status = "confirmed";

    await booking.save();

    console.log(
      `Booking ${booking._id} marked as paid`
    );

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
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