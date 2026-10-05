const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    // ==========================================
    // PROPERTY INFORMATION
    // ==========================================

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    propertyType: {
      type: String,
      enum: ["LAND", "HOUSE"],
      required: true,
    },

    listingType: {
      type: String,
      enum: ["SALE", "RENT"],
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "GHS",
      uppercase: true,
      trim: true,
    },

    // ==========================================
    // LOCATION
    // ==========================================

    address: {
      region: {
        type: String,
        trim: true,
      },

      city: {
        type: String,
        trim: true,
      },

      area: {
        type: String,
        trim: true,
      },

      addressLine: {
        type: String,
        trim: true,
      },
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        default: undefined,
      },
    },

    // ==========================================
    // PROPERTY MEDIA
    // ==========================================

    images: [
      {
        type: String,
        trim: true,
      },
    ],

    videos: [
      {
        type: String,
        trim: true,
      },
    ],

    // ==========================================
    // CONFIDENTIAL OWNER REFERENCE
    //
    // This is NOT a public website user.
    // It refers to the private owner record
    // maintained by Ruvasgod.
    // ==========================================

    ownerRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyOwner",
      required: true,
    },

    // ==========================================
    // RUVA REPRESENTATION
    //
    // Ruvasgod is the company representing
    // and listing the property.
    // ==========================================

    representedBy: {
      type: String,
      default: "Ruvasgod",
      trim: true,
    },

    // ==========================================
    // VERIFICATION
    // ==========================================

    verificationStatus: {
      type: String,
      enum: [
        "PENDING",
        "UNDER_REVIEW",
        "VERIFIED",
        "REJECTED",
        "SUSPENDED",
        "DISPUTED",
      ],
      default: "PENDING",
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ==========================================
    // PUBLIC LISTING STATUS
    // ==========================================

    listingStatus: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING_REVIEW",
        "PUBLISHED",
        "SOLD",
        "RENTED",
        "ARCHIVED",
      ],
      default: "DRAFT",
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    // ==========================================
    // PROPERTY FEATURES
    // ==========================================

    bedrooms: {
      type: Number,
      min: 0,
      default: null,
    },

    bathrooms: {
      type: Number,
      min: 0,
      default: null,
    },

    landSize: {
      value: {
        type: Number,
        min: 0,
        default: null,
      },

      unit: {
        type: String,
        enum: ["SQ_M", "SQ_FT", "ACRE"],
        default: null,
      },
    },

    // ==========================================
    // PUBLIC VISIBILITY
    // ==========================================

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// GEO-SPATIAL INDEX
// ==========================================

propertySchema.index({
  location: "2dsphere",
});

// ==========================================
// SEARCH INDEXES
// ==========================================

propertySchema.index({
  propertyType: 1,
  listingType: 1,
  listingStatus: 1,
});

propertySchema.index({
  verificationStatus: 1,
});

propertySchema.index({
  "address.city": 1,
  "address.area": 1,
});



module.exports = mongoose.model("Property", propertySchema);