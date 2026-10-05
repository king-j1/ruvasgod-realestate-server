const express = require("express");

const {
  uploadOwnerDocument,
  getOwnerDocuments,
  verifyOwnerDocument,
  downloadOwnerDocument,
} = require("../controllers/propertyOwnerDocumentController");

const { protect } = require("../middleware/authMiddleware");

const requireOwnerAccess = require(
  "../middleware/propertyOwnerAccessMiddleware"
);

const upload = require(
  "../middleware/ownerDocumentUploadMiddleware"
);

const router = express.Router();

// UPLOAD OWNER DOCUMENT
// Multer must run first so req.body.ownerRecord exists.
router.post(
  "/",
  protect,
  upload.single("document"),
  uploadOwnerDocument
);

// LIST OWNER DOCUMENTS
router.get(
  "/owner/:ownerId",
  protect,
  requireOwnerAccess("canViewDocuments"),
  getOwnerDocuments
);

// VERIFY OWNER DOCUMENT
router.patch(
  "/:id/verification",
  protect,
  verifyOwnerDocument
);

// SECURELY VIEW / DOWNLOAD OWNER DOCUMENT
router.get(
  "/:id/download",
  protect,
  downloadOwnerDocument
);

module.exports = router;