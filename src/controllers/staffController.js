const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Sale = require("../models/Sale");
const { logAudit } = require("../services/auditService");
const {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  isValidEmail,
  isStrongPassword,
} = require("../utils/authValidation");

const ALLOWED_STAFF_ROLES = [
  "manager",
  "sales",
  "rental",
  "finance",
  "vehicle_manager",
];

// Create a staff account - Admin only
const createStaff = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, password and role are required",
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    // This endpoint never grants admin privileges
    if (!ALLOWED_STAFF_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff role",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const staff = await User.create({
      name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      role,
      isActive: true,
    });

    await logAudit({
      user: req.user._id,
      action: "staff.create",
      resource: "User",
      resourceId: staff._id,
      details: `Created staff member ${staff.email} with role ${staff.role}`,
    });

    res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        isActive: staff.isActive,
        createdAt: staff.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.error("Create staff error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create staff account",
    });
  }
};

// List staff/admin accounts - Admin and Manager (read)
const getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({
  role: { $in: ALLOWED_STAFF_ROLES },
})
      .select("name email phone role isActive createdAt updatedAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: staff.length,
      staff,
    });
  } catch (error) {
    console.error("Get all staff error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch staff",
      error: error.message,
    });
  }
};

// Get one staff account - Admin and Manager (read)
const getStaffById = async (req, res) => {
  try {
    const staff = await User.findOne({
  _id: req.params.id,
  role: { $in: ALLOWED_STAFF_ROLES },
}).select("name email phone role isActive createdAt updatedAt");

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found",
      });
    }

    res.status(200).json({
      success: true,
      staff,
    });
  } catch (error) {
    console.error("Get staff by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch staff account",
      error: error.message,
    });
  }
};

// Update a staff account - Admin only
const updateStaff = async (req, res) => {
  try {
    const { name, phone, role } = req.body || {};

    const staff = await User.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found",
      });
    }

    if (staff.role === "customer") {
      return res.status(400).json({
        success: false,
        message: "This endpoint manages staff accounts only",
      });
    }

    if (staff.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be modified through this endpoint",
      });
    }

    if (role && role !== staff.role) {
      // This endpoint never grants admin privileges
      if (role === "admin") {
        return res.status(403).json({
          success: false,
          message: "This endpoint cannot grant admin privileges",
        });
      }

      if (!ALLOWED_STAFF_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid staff role",
        });
      }

      staff.role = role;
    }

    if (name) staff.name = name;
    if (phone) staff.phone = phone;

    await staff.save();

    await logAudit({
      user: req.user._id,
      action: "staff.update",
      resource: "User",
      resourceId: staff._id,
      details: `Updated staff member ${staff.email}`,
    });

    res.status(200).json({
      success: true,
      message: "Staff account updated successfully",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    console.error("Update staff error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update staff account",
      error: error.message,
    });
  }
};

// Activate/deactivate a staff account - Admin only
const updateStaffStatus = async (req, res) => {
  try {
    const { isActive } = req.body || {};

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive (true/false) is required",
      });
    }

    const staff = await User.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found",
      });
    }

    if (staff.role === "customer") {
      return res.status(400).json({
        success: false,
        message: "This endpoint manages staff accounts only",
      });
    }

    if (staff.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be modified through this endpoint",
      });
    }

    if (staff._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own account status",
      });
    }

    staff.isActive = isActive;

    await staff.save();

    await logAudit({
      user: req.user._id,
      action: isActive ? "staff.activate" : "staff.deactivate",
      resource: "User",
      resourceId: staff._id,
      details: `${isActive ? "Activated" : "Deactivated"} staff member ${staff.email}`,
    });

    res.status(200).json({
      success: true,
      message: `Staff account ${isActive ? "activated" : "deactivated"} successfully`,
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    console.error("Update staff status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update staff status",
      error: error.message,
    });
  }
};

// List customer accounts - Staff read access
const getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" })
      .select("name email phone createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const customerIds = customers.map((customer) => customer._id);

    const [bookingCounts, saleCounts] = await Promise.all([
      Booking.aggregate([
        { $match: { user: { $in: customerIds } } },
        { $group: { _id: "$user", count: { $sum: 1 } } },
      ]),
      Sale.aggregate([
        { $match: { user: { $in: customerIds } } },
        { $group: { _id: "$user", count: { $sum: 1 } } },
      ]),
    ]);

    const bookingCountMap = new Map(
      bookingCounts.map((row) => [row._id.toString(), row.count])
    );

    const saleCountMap = new Map(
      saleCounts.map((row) => [row._id.toString(), row.count])
    );

    const customersWithCounts = customers.map((customer) => ({
      ...customer,
      bookingCount: bookingCountMap.get(customer._id.toString()) || 0,
      saleCount: saleCountMap.get(customer._id.toString()) || 0,
    }));

    res.status(200).json({
      success: true,
      count: customersWithCounts.length,
      customers: customersWithCounts,
    });
  } catch (error) {
    console.error("Get customers error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};

// Get one customer account - Staff read access
const getCustomerById = async (req, res) => {
  try {
    const customer = await User.findOne({
      _id: req.params.id,
      role: "customer",
    }).select("name email phone createdAt");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const [bookingCount, saleCount] = await Promise.all([
      Booking.countDocuments({ user: customer._id }),
      Sale.countDocuments({ user: customer._id }),
    ]);

    res.status(200).json({
      success: true,
      customer: {
        ...customer.toObject(),
        bookingCount,
        saleCount,
      },
    });
  } catch (error) {
    console.error("Get customer by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: error.message,
    });
  }
};

module.exports = {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  updateStaffStatus,
  getCustomers,
  getCustomerById,
};
