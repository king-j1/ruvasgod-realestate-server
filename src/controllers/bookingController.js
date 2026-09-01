const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");

// Update lifecycle statuses for paid rentals based on current UTC date
const markOverdueBookings = async () => {
  try {
    const now = new Date();
    const todayUtcStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      )
    );

    // Paid bookings should become active on/after start date.
    await Booking.updateMany(
      {
        status: "confirmed",
        paymentStatus: "paid",
        startDate: { $lte: todayUtcStart },
        endDate: { $gte: todayUtcStart },
      },
      {
        $set: {
          status: "active",
        },
      }
    );

    // After the end date has passed, paid rentals should be completed.
    await Booking.updateMany(
      {
        status: { $in: ["confirmed", "active", "overdue"] },
        paymentStatus: "paid",
        endDate: { $lt: todayUtcStart },
      },
      {
        $set: {
          status: "completed",
        },
      }
    );
  } catch (error) {
    console.error("Mark overdue bookings error:", error);
  }
};


// Create a rental booking
const createBooking = async (req, res) => {
  try {
    const {
      vehicleId,
      startDate,
      endDate,
    } = req.body;

    if (!vehicleId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Vehicle, start date, and end date are required",
      });
    }

    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (!vehicle.availableForRent) {
      return res.status(400).json({
        success: false,
        message: "This vehicle is not available for rental",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start or end date",
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Prevent overlapping bookings
    const existingBooking = await Booking.findOne({
      vehicle: vehicleId,
      status: {
        $in: ["pending", "confirmed", "active", "overdue"],
      },
      startDate: {
        $lt: end,
      },
      endDate: {
        $gt: start,
      },
    });

    if (existingBooking) {
      const conflictingStart = existingBooking.startDate
        .toISOString()
        .split("T")[0];

      const conflictingEnd = existingBooking.endDate
        .toISOString()
        .split("T")[0];

      return res.status(409).json({
        success: false,
        message: `Vehicle is already booked for these dates (${existingBooking.status}: ${conflictingStart} to ${conflictingEnd})`,
      });
    }

    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    const rentalDays = Math.ceil(
      (end - start) / millisecondsPerDay
    );

    const totalPrice =
      rentalDays * vehicle.rentalPricePerDay;

    const booking = await Booking.create({
      user: req.user._id,
      vehicle: vehicleId,
      startDate: start,
      endDate: end,
      totalPrice,
      status: "pending",
      paymentStatus: "unpaid",
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
};


// Get customer's bookings
const getMyBookings = async (req, res) => {
  try {
    await markOverdueBookings();

    const bookings = await Booking.find({
      user: req.user._id,
    })
      .populate("vehicle")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};


// Get one booking
const getBookingById = async (req, res) => {
  try {
    await markOverdueBookings();

    const booking = await Booking.findById(req.params.id)
      .populate("vehicle");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this booking",
      });
    }

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Get booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
      error: error.message,
    });
  }
};


// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this booking",
      });
    }

    if (booking.status === "active") {
      return res.status(400).json({
        success: false,
        message: "Active bookings cannot be cancelled",
      });
    }

    if (booking.status === "overdue") {
      return res.status(400).json({
        success: false,
        message: "Overdue bookings cannot be cancelled",
      });
    }

    if (booking.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed bookings cannot be cancelled",
      });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
      });
    }

    booking.status = "cancelled";

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
      error: error.message,
    });
  }
};


// Get all bookings - Admin only
const getAllBookings = async (req, res) => {
  try {
    await markOverdueBookings();

    const bookings = await Booking.find()
      .populate("user", "name email phone role")
      .populate("vehicle")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get all bookings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};



// Update booking status - Admin only
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "confirmed",
      "active",
      "completed",
      "overdue",
      "cancelled",
    ];

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Booking status is required",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
      });
    }

    const booking = await Booking.findById(req.params.id)
      .populate("user", "name email phone role")
      .populate("vehicle");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Define allowed booking transitions
    const allowedTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["active", "cancelled"],
      active: ["completed"],
      completed: [],
      overdue: [],
      cancelled: [],
    };

    const currentStatus = booking.status;

    if (!allowedTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change booking from ${currentStatus} to ${status}`,
      });
    }

    booking.status = status;

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Update booking status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    });
  }
};

// Check vehicle availability for given dates
const checkAvailability = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate inputs
    if (!vehicleId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID and dates are required",
      });
    }

    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start or end date",
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    if (!vehicle.availableForRent) {
      return res.status(200).json({
        success: true,
        available: false,
        reason: "Vehicle is not available for rental",
      });
    }

    // Check for overlapping bookings
    const conflictingBooking = await Booking.findOne({
      vehicle: vehicleId,
      status: {
        $in: ["pending", "confirmed", "active", "overdue"],
      },
      startDate: {
        $lt: end,
      },
      endDate: {
        $gt: start,
      },
    });

    if (conflictingBooking) {
      return res.status(200).json({
        success: true,
        available: false,
        reason: "Vehicle is booked for these dates",
      });
    }

    res.status(200).json({
      success: true,
      available: true,
    });
  } catch (error) {
    console.error("Check availability error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to check availability",
      error: error.message,
    });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
  checkAvailability,
};