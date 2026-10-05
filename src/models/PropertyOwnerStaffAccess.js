const mongoose = require("mongoose");

const propertyOwnerStaffAccessSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    ownerRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyOwner",
      required: true,
      index: true,
    },

    canViewOwner: {
      type: Boolean,
      default: false,
    },

    canViewDocuments: {
      type: Boolean,
      default: false,
    },

    canUploadDocuments: {
      type: Boolean,
      default: false,
    },

    canVerifyDocuments: {
      type: Boolean,
      default: false,
    },

    canDownloadDocuments: {
      type: Boolean,
      default: false,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

propertyOwnerStaffAccessSchema.index(
  {
    staff: 1,
    ownerRecord: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "PropertyOwnerStaffAccess",
  propertyOwnerStaffAccessSchema
);