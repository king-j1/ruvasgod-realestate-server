const Sale = require("../models/Sale");
const Vehicle = require("../models/Vehicle");

// Create a sale record for a vehicle
const createSale = async (req, res) => {
  try {
    const { vehicleId } = req.body;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }

    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (!vehicle.availableForSale) {
      return res.status(400).json({
        success: false,
        message: "This vehicle is not available for sale",
      });
    }

    const sale = await Sale.create({
      user: req.user._id,
      vehicle: vehicle._id,
      salePrice: vehicle.price,
      currency: "GHS",
      paymentStatus: "unpaid",
      saleStatus: "pending",
      ownershipStatus: "pending_transfer",
    });

    const populatedSale = await Sale.findById(sale._id)
      .populate("vehicle")
      .populate("user", "name email phone role");

    res.status(201).json({
      success: true,
      message: "Sale created successfully",
      sale: populatedSale,
    });
  } catch (error) {
    console.error("Create sale error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create sale",
      error: error.message,
    });
  }
};

// Get current user's sales
const getMySales = async (req, res) => {
  try {
    const sales = await Sale.find({ user: req.user._id })
      .populate("vehicle")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: sales.length,
      sales,
    });
  } catch (error) {
    console.error("Get my sales error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch your sales",
      error: error.message,
    });
  }
};

// Get one sale
const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("vehicle")
      .populate("user", "name email phone role");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const isOwner = sale.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this sale",
      });
    }

    res.status(200).json({
      success: true,
      sale,
    });
  } catch (error) {
    console.error("Get sale by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch sale",
      error: error.message,
    });
  }
};

// Get all sales - Admin only
const getAllSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate("user", "name email phone role")
      .populate("vehicle")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: sales.length,
      sales,
    });
  } catch (error) {
    console.error("Get all sales error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch sales",
      error: error.message,
    });
  }
};

// Update sale status - Admin only
const updateSaleStatus = async (req, res) => {
  try {
    const { saleStatus, ownershipStatus } = req.body;

    if (!saleStatus) {
      return res.status(400).json({
        success: false,
        message: "Sale status is required",
      });
    }

    if (ownershipStatus) {
      return res.status(400).json({
        success: false,
        message: "Ownership status cannot be changed manually here",
      });
    }

    const allowedTargetStatuses = ["reserved", "cancelled", "failed"];

    if (!allowedTargetStatuses.includes(saleStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or restricted sale status update",
      });
    }

    const sale = await Sale.findById(req.params.id)
      .populate("user", "name email phone role")
      .populate("vehicle");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const allowedTransitions = {
      pending: ["reserved", "cancelled", "failed"],
      reserved: ["cancelled", "failed"],
      completed: [],
      cancelled: [],
      failed: [],
      refunded: [],
    };

    const currentStatus = sale.saleStatus;

    if (!allowedTransitions[currentStatus].includes(saleStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change sale from ${currentStatus} to ${saleStatus}`,
      });
    }

    sale.saleStatus = saleStatus;

    if (saleStatus === "cancelled") {
      sale.cancelledAt = new Date();
      sale.ownershipStatus = "cancelled";
    }

    await sale.save();

    res.status(200).json({
      success: true,
      message: "Sale status updated successfully",
      sale,
    });
  } catch (error) {
    console.error("Update sale status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update sale status",
      error: error.message,
    });
  }
};

module.exports = {
  createSale,
  getMySales,
  getSaleById,
  getAllSales,
  updateSaleStatus,
};
