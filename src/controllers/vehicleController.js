const Vehicle = require("../models/Vehicle");
const Booking = require("../models/Booking");
const cloudinary = require("../config/cloudinary");

// Allowed fields for vehicle creation and update
const ALLOWED_FIELDS = [
  "make",
  "model",
  "year",
  "price",
  "rentalPricePerDay",
  "type",
  "fuelType",
  "transmission",
  "mileage",
  "color",
  "condition",
  "description",
  "location",
  "availableForSale",
  "availableForRent",
  "isFeatured",
];

// Validate vehicle data
const validateVehicleData = (data) => {
  const errors = [];

  // Required text fields
  if (
    !data.make ||
    typeof data.make !== "string" ||
    !data.make.trim()
  ) {
    errors.push(
      "Make is required and must be a non-empty string"
    );
  }

  if (
    !data.model ||
    typeof data.model !== "string" ||
    !data.model.trim()
  ) {
    errors.push(
      "Model is required and must be a non-empty string"
    );
  }

  // Year
  if (
    !Number.isFinite(data.year) ||
    data.year < 1900 ||
    data.year > new Date().getFullYear() + 1
  ) {
    errors.push(
      "Year is required and must be a valid year"
    );
  }

  // Vehicle type
  const validTypes = [
    "SUV",
    "Sedan",
    "Pickup",
    "Sports",
    "Electric",
    "Luxury",
    "Van",
  ];

  if (!data.type || typeof data.type !== "string") {
    errors.push("Type is required");
  } else if (!validTypes.includes(data.type)) {
    errors.push(
      `Type must be one of: ${validTypes.join(", ")}`
    );
  }

  // Fuel type
  const validFuelTypes = [
    "Petrol",
    "Diesel",
    "Electric",
    "Hybrid",
  ];

  if (
    !data.fuelType ||
    typeof data.fuelType !== "string"
  ) {
    errors.push("Fuel type is required");
  } else if (!validFuelTypes.includes(data.fuelType)) {
    errors.push(
      `Fuel type must be one of: ${validFuelTypes.join(
        ", "
      )}`
    );
  }

  // Transmission
  const validTransmissions = ["Automatic", "Manual"];

  if (
    !data.transmission ||
    typeof data.transmission !== "string"
  ) {
    errors.push("Transmission is required");
  } else if (!validTransmissions.includes(data.transmission)) {
    errors.push(
      `Transmission must be one of: ${validTransmissions.join(
        ", "
      )}`
    );
  }

  // Condition
  const validConditions = ["New", "Used"];

  if (
    !data.condition ||
    typeof data.condition !== "string"
  ) {
    errors.push("Condition is required");
  } else if (!validConditions.includes(data.condition)) {
    errors.push(
      `Condition must be one of: ${validConditions.join(
        ", "
      )}`
    );
  }

  // Sale / rental availability
  const availableForSale =
    data.availableForSale === true;

  const availableForRent =
    data.availableForRent === true;

  if (!availableForSale && !availableForRent) {
    errors.push(
      "Vehicle must be available for at least sale or rental"
    );
  }

  // Sale price
  if (availableForSale) {
    if (
      !Number.isFinite(data.price) ||
      data.price <= 0
    ) {
      errors.push(
        "Sale price is required and must be a positive number when vehicle is available for sale"
      );
    }
  }

  // Rental price
  if (availableForRent) {
    if (
      !Number.isFinite(data.rentalPricePerDay) ||
      data.rentalPricePerDay <= 0
    ) {
      errors.push(
        "Rental price per day is required and must be a positive number when vehicle is available for rental"
      );
    }
  }

  // Mileage
  if (
    data.mileage !== undefined &&
    (!Number.isFinite(data.mileage) ||
      data.mileage < 0)
  ) {
    errors.push(
      "Mileage must be a valid number greater than or equal to 0"
    );
  }

  return errors;
};

// Filter and sanitize vehicle data
const sanitizeVehicleData = (data) => {
  const sanitized = {};

  ALLOWED_FIELDS.forEach((field) => {
    if (field in data) {
      sanitized[field] = data[field];
    }
  });

  return sanitized;
};

// Convert FormData values into correct JavaScript types
const normalizeVehicleData = (data) => {
  const normalized = { ...data };

  // Convert numeric fields
  const numericFields = [
    "year",
    "price",
    "rentalPricePerDay",
    "mileage",
  ];

  numericFields.forEach((field) => {
    if (
      normalized[field] !== undefined &&
      normalized[field] !== ""
    ) {
      normalized[field] = Number(normalized[field]);
    }
  });

  // Convert boolean fields
  const booleanFields = [
    "availableForSale",
    "availableForRent",
    "isFeatured",
  ];

  booleanFields.forEach((field) => {
    if (normalized[field] !== undefined) {
      normalized[field] =
        normalized[field] === true ||
        normalized[field] === "true";
    }
  });

  return normalized;
};

// Get Cloudinary public ID from a stored secure URL
const getCloudinaryPublicId = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    return null;
  }

  const parts = imageUrl.split("/upload/");

  if (parts.length < 2) {
    return null;
  }

  const pathParts = parts[1].split("/");

  // Remove Cloudinary version such as v1788344790
  if (pathParts[0]?.startsWith("v")) {
    pathParts.shift();
  }

  const publicIdWithExtension = pathParts.join("/");

  return publicIdWithExtension.replace(
    /\.[^/.]+$/,
    ""
  );
};

// Delete an image from Cloudinary
const deleteCloudinaryImage = async (imageUrl) => {
  const publicId =
    getCloudinaryPublicId(imageUrl);

  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(
      "Cloudinary image deletion error:",
      error
    );
  }
};

// Upload one image to Cloudinary
const uploadVehicleImage = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
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
};

// Create a vehicle
const createVehicle = async (req, res) => {
  try {
    // Sanitize and normalize incoming data
    const sanitizedData = normalizeVehicleData(
      sanitizeVehicleData(req.body)
    );

    // Validate vehicle data
    const validationErrors =
      validateVehicleData(sanitizedData);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    let images = [];

    // Upload images to Cloudinary
    if (req.files && req.files.length > 0) {
      images = await Promise.all(
        req.files.map((file) =>
          uploadVehicleImage(file)
        )
      );
    }

    // Create vehicle
    const vehicle = await Vehicle.create({
      ...sanitizedData,
      images,
    });

    res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      vehicle,
    });
  } catch (error) {
    console.error(
      "Create vehicle error:",
      error
    );

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
    const vehicles = await Vehicle.find().sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    console.error(
      "Get vehicles error:",
      error
    );

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
    const vehicle = await Vehicle.findById(
      req.params.id
    );

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
    console.error(
      "Get vehicle error:",
      error
    );

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
    const vehicle = await Vehicle.findById(
      req.params.id
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Sanitize and normalize incoming data
    const sanitizedData =
      normalizeVehicleData(
        sanitizeVehicleData(req.body)
      );

    // Merge with existing vehicle data
    const mergedData =
      normalizeVehicleData({
        ...vehicle.toObject(),
        ...sanitizedData,
      });

    // Validate updated vehicle
    const validationErrors =
      validateVehicleData(mergedData);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Update normal vehicle fields
    Object.keys(sanitizedData).forEach(
      (key) => {
        vehicle[key] = sanitizedData[key];
      }
    );

    // -----------------------------------------
    // IMAGE MANAGEMENT
    // -----------------------------------------

    let images = [...(vehicle.images || [])];

    let imageActions = [];
    let removeImages = [];

    // Read image actions from FormData
    if (req.body.imageActions) {
      try {
        imageActions = JSON.parse(
          req.body.imageActions
        );

        if (!Array.isArray(imageActions)) {
          imageActions = [];
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid imageActions data",
        });
      }
    }

    // Read images to remove from FormData
    if (req.body.removeImages) {
      try {
        removeImages = JSON.parse(
          req.body.removeImages
        );

        if (!Array.isArray(removeImages)) {
          removeImages = [];
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid removeImages data",
        });
      }
    }

    // -----------------------------------------
    // UPLOAD NEW IMAGES
    // -----------------------------------------

    let uploadedImages = [];

    if (req.files && req.files.length > 0) {
      uploadedImages = await Promise.all(
        req.files.map((file) =>
          uploadVehicleImage(file)
        )
      );
    }

    // -----------------------------------------
    // REPLACE EXISTING IMAGES
    // -----------------------------------------

    const oldImagesToDelete = [];

    for (const action of imageActions) {
      if (action.action !== "replace") {
        continue;
      }

      const fileIndex = Number(
        action.fileIndex
      );

      const imageIndex = Number(
        action.imageIndex
      );

      if (
        !Number.isInteger(fileIndex) ||
        !Number.isInteger(imageIndex)
      ) {
        continue;
      }

      if (
        fileIndex < 0 ||
        fileIndex >= uploadedImages.length
      ) {
        continue;
      }

      if (
        imageIndex < 0 ||
        imageIndex >= images.length
      ) {
        continue;
      }

      const oldImage = images[imageIndex];
      const newImage = uploadedImages[fileIndex];

      images[imageIndex] = newImage;

      if (oldImage) {
        oldImagesToDelete.push(oldImage);
      }
    }

    // -----------------------------------------
    // REMOVE EXISTING IMAGES
    // -----------------------------------------

    if (removeImages.length > 0) {
      const imagesBeingRemoved =
        images.filter((imageUrl) =>
          removeImages.includes(imageUrl)
        );

      images = images.filter(
        (imageUrl) =>
          !removeImages.includes(imageUrl)
      );

      oldImagesToDelete.push(
        ...imagesBeingRemoved
      );
    }

    // -----------------------------------------
    // ADD NEW IMAGES
    // -----------------------------------------

    for (const action of imageActions) {
      if (action.action !== "add") {
        continue;
      }

      const fileIndex = Number(
        action.fileIndex
      );

      if (
        !Number.isInteger(fileIndex) ||
        fileIndex < 0 ||
        fileIndex >= uploadedImages.length
      ) {
        continue;
      }

      images.push(
        uploadedImages[fileIndex]
      );
    }

    /*
      Backward compatibility:

      If the frontend simply uploads images
      without sending imageActions, behave exactly
      as the old system did and append them.
    */
    if (
      uploadedImages.length > 0 &&
      imageActions.length === 0
    ) {
      images.push(...uploadedImages);
    }

    // Remove duplicate image URLs
    images = [...new Set(images)];

    // Save updated image list
    vehicle.images = images;

    await vehicle.save();

    // -----------------------------------------
    // DELETE OLD CLOUDINARY IMAGES
    // -----------------------------------------

    if (oldImagesToDelete.length > 0) {
      const uniqueOldImages = [
        ...new Set(oldImagesToDelete),
      ];

      await Promise.all(
        uniqueOldImages.map(
          (imageUrl) =>
            deleteCloudinaryImage(imageUrl)
        )
      );
    }

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      vehicle,
    });
  } catch (error) {
    console.error(
      "Update vehicle error:",
      error
    );

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
    const vehicle = await Vehicle.findById(
      req.params.id
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Delete vehicle images from Cloudinary
    if (
      vehicle.images &&
      vehicle.images.length > 0
    ) {
      const deletePromises =
        vehicle.images.map((imageUrl) =>
          deleteCloudinaryImage(imageUrl)
        );

      await Promise.all(deletePromises);
    }

    await vehicle.deleteOne();

    res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete vehicle error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to delete vehicle",
      error: error.message,
    });
  }
};

// Get alternative vehicles for given dates
const getAlternativeVehicles = async (
  req,
  res
) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } =
      req.query;

    // Validate inputs
    if (!id || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "Vehicle ID and dates are required",
      });
    }

    // Get requested vehicle
    const requestedVehicle =
      await Vehicle.findById(id);

    if (!requestedVehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      isNaN(start.getTime()) ||
      isNaN(end.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid start or end date",
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message:
          "End date must be after start date",
      });
    }

    // Find same-type rental vehicles
    const candidateVehicles =
      await Vehicle.find({
        type: requestedVehicle.type,
        availableForRent: true,
        _id: { $ne: id },
      });

    // Filter out vehicles with conflicting bookings
    const availableVehicles = [];

    for (const vehicle of candidateVehicles) {
      const conflictingBooking =
        await Booking.findOne({
          vehicle: vehicle._id,
          status: {
            $in: [
              "pending",
              "confirmed",
              "active",
              "overdue",
            ],
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

    // Sort by rental price difference
    availableVehicles.sort((a, b) => {
      const aPriceDiff = Math.abs(
        a.rentalPricePerDay -
          requestedVehicle.rentalPricePerDay
      );

      const bPriceDiff = Math.abs(
        b.rentalPricePerDay -
          requestedVehicle.rentalPricePerDay
      );

      return aPriceDiff - bPriceDiff;
    });

    // Return up to 6 alternatives
    const alternatives =
      availableVehicles.slice(0, 6);

    res.status(200).json({
      success: true,
      count: alternatives.length,
      vehicles: alternatives,
    });
  } catch (error) {
    console.error(
      "Get alternative vehicles error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch alternative vehicles",
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