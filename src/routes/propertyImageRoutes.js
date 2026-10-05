
const express = require("express");

const {
  uploadPropertyImages,
  deletePropertyImage,
  deleteAllPropertyImages,
} = require("../controllers/propertyImageController");

const { protect } = require("../middleware/authMiddleware");
const staffOnly = require("../middleware/staffMiddleware");

const uploadPropertyImageFiles = require(
  "../middleware/propertyImageUploadMiddleware"
);

const router = express.Router();

// ==========================================
// PROPERTY IMAGE UPLOAD
// ==========================================

router.post(
  "/:id/images",
  protect,
  staffOnly("admin", "manager"),
  uploadPropertyImageFiles,
  uploadPropertyImages
);

// ==========================================
// DELETE PROPERTY IMAGE
// ==========================================

router.delete(
  "/:id/images",
  protect,
  staffOnly("admin", "manager"),
  deleteAllPropertyImages
);

router.delete(
  "/:id/images/:imageIndex",
  protect,
  staffOnly("admin", "manager"),
  deletePropertyImage
);

module.exports = router;

