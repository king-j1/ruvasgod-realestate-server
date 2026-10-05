const express = require("express");

const {
  assignStaffToPropertyOwner,
  getOwnerStaffAccess,
  revokeStaffOwnerAccess,
} = require("../controllers/propertyOwnerAccessController");

const { protect } = require("../middleware/authMiddleware");
const staffOnly = require("../middleware/staffMiddleware");

const router = express.Router();

// ==========================================
// ASSIGN STAFF TO OWNER
// ==========================================

router.post(
  "/",
  protect,
  staffOnly("admin"),
  assignStaffToPropertyOwner
);

// ==========================================
// VIEW OWNER STAFF ASSIGNMENTS
// ==========================================

router.get(
  "/owner/:ownerId",
  protect,
  staffOnly("admin"),
  getOwnerStaffAccess
);

// ==========================================
// REVOKE STAFF ACCESS
// ==========================================

router.patch(
  "/:id/revoke",
  protect,
  staffOnly("admin"),
  revokeStaffOwnerAccess
);

module.exports = router;