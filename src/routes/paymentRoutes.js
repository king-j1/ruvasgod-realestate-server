const express = require("express");

const {
  initializeBookingPayment,
  verifyBookingPayment,
  handlePaystackWebhook,
  initializeSalePayment,
  verifySalePayment,
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
  "/sales/initialize",
  protect,
  initializeSalePayment
);

router.get(
  "/sales/verify/:reference",
  protect,
  verifySalePayment
);

router.post(
  "/webhook",
  handlePaystackWebhook
);

module.exports = router;