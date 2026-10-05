const mongoose = require("mongoose");

const propertyOwnerSchema = new mongoose.Schema(
  {
    // ==========================================
    // PRIVATE OWNER IDENTITY
    // ==========================================

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },

    // ==========================================
    // PRIVATE IDENTITY INFORMATION
    // ==========================================

    identificationType: {
      type: String,
      enum: [
        "GH_CARD",
        "PASSPORT",
        "DRIVERS_LICENSE",
        "VOTER_ID",
        "OTHER",
      ],
      default: null,
    },

    identificationNumber: {
      type: String,
      trim: true,
      default: null,
    },

    // ==========================================
    // OWNER TYPE
    // ==========================================

    ownerType: {
      type: String,
      enum: [
        "INDIVIDUAL",
        "COMPANY",
        "ORGANIZATION",
        "ESTATE",
        "TRUST",
        "OTHER",
      ],
      default: "INDIVIDUAL",
    },

    companyName: {
      type: String,
      trim: true,
      default: null,
    },

    // ==========================================
    // OWNER VERIFICATION
    // ==========================================

    verificationStatus: {
      type: String,
      enum: [
        "PENDING",
        "UNDER_REVIEW",
        "VERIFIED",
        "REJECTED",
        "SUSPENDED",
      ],
      default: "PENDING",
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    // ==========================================
    // INTERNAL NOTES
    //
    // NEVER expose this through public APIs.
    // ==========================================

    internalNotes: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // RECORD STATUS
    // ==========================================

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// INDEXES
// ==========================================

propertyOwnerSchema.index({
  phone: 1,
});

propertyOwnerSchema.index({
  email: 1,
});

propertyOwnerSchema.index({
  verificationStatus: 1,
});

module.exports = mongoose.model("PropertyOwner", propertyOwnerSchema);