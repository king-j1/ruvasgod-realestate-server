const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");

// Create a rental booking
const createBooking = async (req, res) => {
  try {
    const {
      vehicleId,
      startDate,
      endDate,
    } = req.body;

    // Make sure required information was provided
    if (!vehicleId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Vehicle, start date, and end date are required",
      });
    }

    // Find the vehicle
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Make sure the vehicle is available for rental
    if (!vehicle.availableForRent) {
      return res.status(400).json({
        success: false,
        message: "This vehicle is not available for rental",
      });
    }

    // Convert dates into JavaScript Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Make sure dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start or end date",
      });
    }

    // End date must be after start date
    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Check if the vehicle is already booked
    const existingBooking = await Booking.findOne({
      vehicle: vehicleId,
      status: {
        $in: ["pending", "confirmed", "active"],
      },
      startDate: {
        $lt: end,
      },
      endDate: {
        $gt: start,
      },
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: "Vehicle is already booked for these dates",
      });
    }

    // Calculate number of rental days
    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    const rentalDays = Math.ceil(
      (end - start) / millisecondsPerDay
    );

    // Calculate total rental price
    const totalPrice =
      rentalDays * vehicle.rentalPricePerDay;

    // Create the booking
    const booking = await Booking.create({
      user: req.user._id,
      vehicle: vehicleId,
      startDate: start,
      endDate: end,
      totalPrice,
      status: "pending",
      paymentStatus: "unpaid",
    });

    // Return the booking
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

// Get all bookings belonging to the logged-in customer
const getMyBookings = async (req, res) => {
  try {
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
    const booking = await Booking.findById(req.params.id)
      .populate("vehicle");

    // Booking does not exist
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Make sure the customer owns this booking
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

// Cancel a booking
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    // Booking does not exist
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Make sure the customer owns this booking
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this booking",
      });
    }

    // Don't allow cancellation after rental has started
    if (booking.status === "active") {
      return res.status(400).json({
        success: false,
        message: "Active bookings cannot be cancelled",
      });
    }

    // Don't cancel an already completed booking
    if (booking.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed bookings cannot be cancelled",
      });
    }

    // Don't cancel an already cancelled booking
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
      });
    }

    // Change booking status
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







// Export controller functions
module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getAllBookings,
};