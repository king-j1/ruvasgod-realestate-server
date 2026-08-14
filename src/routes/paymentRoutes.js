const express = require("express");

const {
  initializeBookingPayment,
  verifyBookingPayment,
  handlePaystackWebhook,
} = require("../controllers/paymentController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/initialize",
  protect,
  initializeBookingPayment
);

router.get(
  "/verify/:reference",
  protect,
  verifyBookingPayment
);

router.post(
  "/webhook",
  handlePaystackWebhook
);

module.exports = router;