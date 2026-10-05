const mongoose = require("mongoose");

const propertyOwnerDocumentSchema = new mongoose.Schema(
  {
    // ==========================================
    // OWNER
    // ==========================================

    ownerRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyOwner",
      required: true,
      index: true,
    },

    // ==========================================
    // DOCUMENT INFORMATION
    // ==========================================

    documentType: {
      type: String,
      enum: [
        "GH_CARD",
        "PASSPORT",
        "DRIVERS_LICENSE",
        "VOTER_ID",
        "LAND_DOCUMENT",
        "TITLE_DEED",
        "SITE_PLAN",
        "OWNERSHIP_DOCUMENT",
        "POWER_OF_ATTORNEY",
        "COMPANY_DOCUMENT",
        "OTHER",
      ],
      required: true,
    },

    documentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // ==========================================
    // PRIVATE FILE
    // ==========================================

    fileUrl: {
      type: String,
      required: true,
    },

    publicId: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      default: 0,
    },

    // ==========================================
    // DOCUMENT VERIFICATION
    // ==========================================

    verificationStatus: {
      type: String,
      enum: [
        "PENDING",
        "UNDER_REVIEW",
        "VERIFIED",
        "REJECTED",
      ],
      default: "PENDING",
      index: true,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    // ==========================================
    // AUDIT / OWNERSHIP
    // ==========================================

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    // ==========================================
    // ACTIVE RECORD
    // ==========================================

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

propertyOwnerDocumentSchema.index({
  ownerRecord: 1,
  documentType: 1,
});

module.exports = mongoose.model(
  "PropertyOwnerDocument",
  propertyOwnerDocumentSchema
);