const express = require("express");

const {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
} = require("../controllers/bookingController");

const { protect } = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// Create a rental booking
router.post("/", protect, createBooking);

// Get logged-in customer's bookings
router.get("/my-bookings", protect, getMyBookings);

// Update booking status - Admin only
router.put(
  "/admin/:id/status",
  protect,
  adminOnly,
  updateBookingStatus
);

// Get all bookings - Admin only
router.get("/admin", protect, adminOnly, getAllBookings);

// Get one booking
router.get("/:id", protect, getBookingById);

// Cancel a booking
router.put("/:id/cancel", protect, cancelBooking);

module.exports = router;