
const express = require("express");

const {
  createPropertyOwner,
  getPropertyOwner,
  updatePropertyOwnerVerification,
} = require("../controllers/propertyOwnerController");

const { protect } = require("../middleware/authMiddleware");
const staffOnly = require("../middleware/staffMiddleware");
const requireOwnerAccess = require(
  "../middleware/propertyOwnerAccessMiddleware"
);

const router = express.Router();

// ============================================================
// CREATE PROPERTY OWNER
// ============================================================

router.post(
  "/",
  protect,
  staffOnly("admin", "manager"),
  createPropertyOwner
);

// ============================================================
// GET PRIVATE PROPERTY OWNER
// ============================================================
// Staff must be explicitly assigned to THIS owner and have
// canViewOwner permission.

router.get(
  "/:id",
  protect,
  requireOwnerAccess("canViewOwner"),
  getPropertyOwner
);

// ============================================================
// UPDATE PROPERTY OWNER VERIFICATION
// ============================================================

router.patch(
  "/:id/verification",
  protect,
  requireOwnerAccess("canViewOwner"),
  updatePropertyOwnerVerification
);

module.exports = router;

