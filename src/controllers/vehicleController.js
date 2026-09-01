const Vehicle = require("../models/Vehicle");
const Booking = require("../models/Booking");
const cloudinary = require("../config/cloudinary");

// Create a vehicle
const createVehicle = async (req, res) => {
  try {
    let images = [];

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "ruvasgod-auto/vehicles",
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result.secure_url);
              }
            }
          );

          uploadStream.end(file.buffer);
        });
      });

      images = await Promise.all(uploadPromises);
    }

    const vehicle = await Vehicle.create({
      ...req.body,
      images,
    });

    res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      vehicle,
    });
  } catch (error) {
    console.error("Create vehicle error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create vehicle",
      error: error.message,
    });
  }
};


// Get all vehicles
const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch vehicles",
      error: error.message,
    });
  }
};


// Get one vehicle
const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    res.status(200).json({
      success: true,
      vehicle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch vehicle",
      error: error.message,
    });
  }
};


// Update a vehicle
const updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Update normal vehicle fields
    Object.keys(req.body).forEach((key) => {
      vehicle[key] = req.body[key];
    });

    // Upload new images if provided
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "ruvasgod-auto/vehicles",
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result.secure_url);
              }
            }
          );

          uploadStream.end(file.buffer);
        });
      });

      const newImages = await Promise.all(uploadPromises);

      // Add new images to existing images
      vehicle.images = [
        ...vehicle.images,
        ...newImages,
      ];
    }

    await vehicle.save();

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      vehicle,
    });
  } catch (error) {
    console.error("Update vehicle error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update vehicle",
      error: error.message,
    });
  }
};


// Delete a vehicle
const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Delete vehicle images from Cloudinary
    if (vehicle.images && vehicle.images.length > 0) {
      const deletePromises = vehicle.images.map((imageUrl) => {
        const parts = imageUrl.split("/upload/");

        if (parts.length < 2) {
          return Promise.resolve();
        }

        const publicIdWithExtension = parts[1]
          .split("/")
          .slice(1)
          .join("/");

        const publicId = publicIdWithExtension
          .replace(/\.[^/.]+$/, "");

        return cloudinary.uploader.destroy(publicId);
      });

      await Promise.all(deletePromises);
    }

    await vehicle.deleteOne();

    res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    console.error("Delete vehicle error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete vehicle",
      error: error.message,
    });
  }
};


// Get alternative vehicles for given dates
const getAlternativeVehicles = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Validate inputs
    if (!id || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID and dates are required",
      });
    }

    // Get the requested vehicle
    const requestedVehicle = await Vehicle.findById(id);

    if (!requestedVehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Parse and validate dates
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

    // Find vehicles with the same type
    const candidateVehicles = await Vehicle.find({
      type: requestedVehicle.type,
      availableForRent: true,
      _id: { $ne: id }, // Exclude the requested vehicle
    });

    // Filter out vehicles with conflicting bookings
    const availableVehicles = [];

    for (const vehicle of candidateVehicles) {
      // Check for overlapping bookings
      const conflictingBooking = await Booking.findOne({
        vehicle: vehicle._id,
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

      if (!conflictingBooking) {
        availableVehicles.push(vehicle);
      }
    }

    // Sort by rental price (closest to the requested vehicle's price first)
    availableVehicles.sort((a, b) => {
      const aPriceDiff = Math.abs(
        a.rentalPricePerDay - requestedVehicle.rentalPricePerDay
      );
      const bPriceDiff = Math.abs(
        b.rentalPricePerDay - requestedVehicle.rentalPricePerDay
      );
      return aPriceDiff - bPriceDiff;
    });

    // Return top 3-6 alternatives
    const alternatives = availableVehicles.slice(0, 6);

    res.status(200).json({
      success: true,
      count: alternatives.length,
      vehicles: alternatives,
    });
  } catch (error) {
    console.error("Get alternative vehicles error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch alternative vehicles",
      error: error.message,
    });
  }
};

module.exports = {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getAlternativeVehicles,
};