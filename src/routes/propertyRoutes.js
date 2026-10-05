
const express = require("express");

const {
  createProperty,
  getPublicProperties,
  getPublicPropertyById,
  getStaffProperties,
  submitPropertyForReview,
  updatePropertyVerification,
  publishProperty,
  unpublishProperty,
  updateProperty,
} = require("../controllers/propertyController");

const { protect } = require("../middleware/authMiddleware");

const staffOnly = require("../middleware/staffMiddleware");

const router = express.Router();

// ==========================================
// STAFF PROPERTY ROUTES
// ==========================================

// Create property

router.post(
  "/staff/create",
  protect,
  staffOnly("admin", "manager"),
  createProperty
);

// Update property

router.patch(
  "/staff/:id",
  protect,
  staffOnly("admin", "manager"),
  updateProperty
);

// Get all properties for staff

router.get(
  "/staff/all",
  protect,
  staffOnly("admin", "manager"),
  getStaffProperties
);

// Submit property for review

router.patch(
  "/staff/:id/submit-review",
  protect,
  staffOnly("admin", "manager"),
  submitPropertyForReview
);

// Verify / reject property

router.patch(
  "/staff/:id/verification",
  protect,
  staffOnly("admin", "manager"),
  updatePropertyVerification
);

// Publish property

router.patch(
  "/staff/:id/publish",
  protect,
  staffOnly("admin", "manager"),
  publishProperty
);

// Unpublish property

router.patch(
  "/staff/:id/unpublish",
  protect,
  staffOnly("admin", "manager"),
  unpublishProperty
);

// ==========================================
// PUBLIC PROPERTY ROUTES
// ==========================================

// Get published properties

router.get("/", getPublicProperties);

// Get one published property

router.get("/:id", getPublicPropertyById);

module.exports = router;

