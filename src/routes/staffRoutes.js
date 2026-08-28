const express = require("express");

const {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  updateStaffStatus,
  getCustomers,
  getCustomerById,
} = require("../controllers/staffController");

const { protect } = require("../middleware/authMiddleware");
const staffOnly = require("../middleware/staffMiddleware");

const router = express.Router();

// Create a staff account - Admin only
router.post("/", protect, staffOnly("admin"), createStaff);

// List staff accounts - Admin and Manager (read)
router.get("/", protect, staffOnly("admin", "manager"), getAllStaff);

// Staff-facing customer management - broader read access
router.get(
  "/customers",
  protect,
  staffOnly("admin", "manager", "sales", "rental"),
  getCustomers
);

router.get(
  "/customers/:id",
  protect,
  staffOnly("admin", "manager", "sales", "rental"),
  getCustomerById
);

// Get one staff account - Admin and Manager (read)
router.get("/:id", protect, staffOnly("admin", "manager"), getStaffById);

// Update a staff account - Admin only
router.put("/:id", protect, staffOnly("admin"), updateStaff);

// Activate/deactivate a staff account - Admin only
router.put(
  "/:id/status",
  protect,
  staffOnly("admin"),
  updateStaffStatus
);

module.exports = router;
