const axios = require("axios");
const crypto = require("crypto");
const Booking = require("../models/Booking");
const { initializePayment } = require("../services/paymentService");



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

    // Make sure this customer owns the booking
    if (
      booking.user._id.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to pay for this booking",
      });
    }

    // Don't allow payment for cancelled bookings
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled bookings cannot be paid for",
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
    const amount = Math.round(
      booking.totalPrice * 100
    );

    // Create unique payment reference
    const reference = `RUVA-${booking._id}-${Date.now()}`;

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
    });

    // Save payment reference
    booking.paymentReference = reference;

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
      error: error.message,
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
    const booking = await Booking.findOne({
      paymentReference: reference,
    });

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

    // Find booking using payment reference
    const booking = await Booking.findOne({
      paymentReference: reference,
    });

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
};