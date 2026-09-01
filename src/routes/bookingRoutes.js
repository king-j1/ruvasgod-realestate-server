const express = require("express");

const {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
  checkAvailability,
} = require("../controllers/bookingController");

const { protect } = require("../middleware/authMiddleware");
const staffOnly = require("../middleware/staffMiddleware");

const router = express.Router();

// Check vehicle availability for given dates (public)
router.get("/availability/:vehicleId", checkAvailability);

// Create a rental booking
router.post("/", protect, createBooking);

// Get logged-in customer's bookings
router.get("/my-bookings", protect, getMyBookings);

// Update booking status - Admin, Manager, Rental
router.put(
  "/admin/:id/status",
  protect,
  staffOnly("admin", "manager", "rental"),
  updateBookingStatus
);

// Get all bookings - Admin, Manager, Rental, Finance (read)
router.get(
  "/admin",
  protect,
  staffOnly("admin", "manager", "rental", "finance"),
  getAllBookings
);

// Get one booking
router.get("/:id", protect, getBookingById);

// Cancel a booking
router.put("/:id/cancel", protect, cancelBooking);

module.exports = router;