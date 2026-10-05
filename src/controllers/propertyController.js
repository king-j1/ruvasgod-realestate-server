
const Property = require("../models/Property");
const PropertyOwner = require("../models/PropertyOwner");
const PropertyOwnerDocument = require("../models/PropertyOwnerDocument");
const PropertyOwnerStaffAccess = require(
  "../models/PropertyOwnerStaffAccess"
);

const { logAudit } = require("../services/auditService");

// ==========================================
// CHECK STAFF OWNER ACCESS
// ==========================================

const checkOwnerAccess = async ({
  userId,
  ownerRecord,
  permission,
}) => {
  const access = await PropertyOwnerStaffAccess.findOne({
    staff: userId,
    ownerRecord,
    isActive: true,
  });

  if (!access) {
    return {
      allowed: false,
      message:
        "Access denied. You are not assigned to this property owner.",
    };
  }

  if (!access[permission]) {
    return {
      allowed: false,
      message:
        "Access denied. You do not have the required permission.",
    };
  }

  return {
    allowed: true,
    access,
  };
};

// ==========================================
// CREATE PROPERTY
// ==========================================

const createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      propertyType,
      listingType,
      price,
      currency,
      address,
      location,
      images,
      videos,
      ownerRecord,
      representedBy,
      bedrooms,
      bathrooms,
      landSize,
      isFeatured,
    } = req.body;

    if (
      !title ||
      !description ||
      !propertyType ||
      !listingType ||
      price === undefined ||
      !ownerRecord
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title, description, property type, listing type, price, and property owner are required.",
      });
    }

    if (!location?.coordinates) {
      return res.status(400).json({
        success: false,
        message: "GPS location coordinates are required.",
      });
    }

    if (
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        success: false,
        message:
          "GPS coordinates must contain longitude and latitude.",
      });
    }

    const [longitude, latitude] = location.coordinates;

    if (
      typeof longitude !== "number" ||
      typeof latitude !== "number" ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid GPS coordinates.",
      });
    }

    const accessCheck = await checkOwnerAccess({
      userId: req.user._id,
      ownerRecord,
      permission: "canViewOwner",
    });

    if (!accessCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: accessCheck.message,
      });
    }

    const propertyOwner = await PropertyOwner.findById(ownerRecord);

    if (!propertyOwner) {
      return res.status(404).json({
        success: false,
        message: "Property owner record not found.",
      });
    }

    if (propertyOwner.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message:
          "This property owner is not active and cannot be assigned a new property.",
      });
    }

    const property = await Property.create({
      title,
      description,
      propertyType,
      listingType,
      price,
      currency,
      address,

      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },

      images: Array.isArray(images) ? images : [],
      videos: Array.isArray(videos) ? videos : [],

      ownerRecord: propertyOwner._id,
      representedBy: representedBy || "Ruvasgod",

      bedrooms,
      bathrooms,
      landSize,

      isFeatured: Boolean(isFeatured),

      listingStatus: "DRAFT",
      isPublished: false,
      verificationStatus: "PENDING",
    });

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_CREATED",
      resource: "Property",
      resourceId: property._id,
      details: `Property created for owner ${propertyOwner._id}`,
    });

    return res.status(201).json({
      success: true,
      message: "Property created successfully.",
      property: {
        id: property._id,
        title: property.title,
        propertyType: property.propertyType,
        listingType: property.listingType,
        price: property.price,
        currency: property.currency,
        ownerRecord: property.ownerRecord,
        listingStatus: property.listingStatus,
        verificationStatus: property.verificationStatus,
        isPublished: property.isPublished,
      },
    });
  } catch (error) {
    console.error("Create property error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create property.",
    });
  }
};

// ==========================================
// GET PUBLIC PROPERTIES
// ==========================================

const getPublicProperties = async (req, res) => {
  try {
    const properties = await Property.find({
      listingStatus: "PUBLISHED",
      verificationStatus: "VERIFIED",
      isPublished: true,
    })
      .select("-ownerRecord -verifiedBy -createdAt -updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    console.error("Get public properties error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch properties.",
    });
  }
};

// ==========================================
// GET PUBLIC PROPERTY BY ID
// ==========================================

const getPublicPropertyById = async (req, res) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      listingStatus: "PUBLISHED",
      verificationStatus: "VERIFIED",
      isPublished: true,
    }).select("-ownerRecord -verifiedBy -createdAt -updatedAt");

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    return res.status(200).json({
      success: true,
      property,
    });
  } catch (error) {
    console.error("Get public property error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch property.",
    });
  }
};

// ==========================================
// GET ALL PROPERTIES - STAFF
// ==========================================

const getStaffProperties = async (req, res) => {
  try {
    const properties = await Property.find()
      .select("-verifiedBy -createdAt -updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    console.error("Get staff properties error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch staff properties.",
    });
  }
};

// ==========================================
// PUT PROPERTY UNDER REVIEW
// ==========================================

const submitPropertyForReview = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (property.listingStatus !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft properties can be submitted for review.",
      });
    }

    property.verificationStatus = "UNDER_REVIEW";
    property.listingStatus = "PENDING_REVIEW";

    await property.save();

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_SUBMITTED_FOR_REVIEW",
      resource: "Property",
      resourceId: property._id,
      details: "Property submitted for verification.",
    });

    return res.status(200).json({
      success: true,
      message: "Property submitted for review.",
      property: {
        id: property._id,
        verificationStatus: property.verificationStatus,
        listingStatus: property.listingStatus,
      },
    });
  } catch (error) {
    console.error("Submit property review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit property for review.",
    });
  }
};

// ==========================================
// VERIFY / REJECT PROPERTY
// ==========================================

const updatePropertyVerification = async (req, res) => {
  try {
    const { verificationStatus } = req.body;

    const allowedStatuses = ["VERIFIED", "REJECTED"];

    if (!allowedStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property verification status.",
      });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    const owner = await PropertyOwner.findById(
      property.ownerRecord
    );

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Property owner record not found.",
      });
    }

    // ==========================================
    // VERIFIED PROPERTY REQUIREMENTS
    // ==========================================

    if (verificationStatus === "VERIFIED") {
      if (owner.verificationStatus !== "VERIFIED") {
        return res.status(400).json({
          success: false,
          message:
            "Property owner must be verified before the property can be verified.",
        });
      }

      const verifiedDocumentCount =
        await PropertyOwnerDocument.countDocuments({
          ownerRecord: owner._id,
          verificationStatus: "VERIFIED",
          isActive: true,
        });

      if (verifiedDocumentCount === 0) {
        return res.status(400).json({
          success: false,
          message:
            "At least one verified owner document is required before the property can be verified.",
        });
      }

      property.verificationStatus = "VERIFIED";
      property.verifiedAt = new Date();
      property.verifiedBy = req.user._id;
    }

    if (verificationStatus === "REJECTED") {
      property.verificationStatus = "REJECTED";
      property.verifiedAt = null;
      property.verifiedBy = req.user._id;
      property.listingStatus = "DRAFT";
      property.isPublished = false;
      property.publishedAt = null;
    }

    await property.save();

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_VERIFICATION_UPDATED",
      resource: "Property",
      resourceId: property._id,
      details:
        `Property verification changed to ${verificationStatus}`,
    });

    return res.status(200).json({
      success: true,
      message:
        `Property ${verificationStatus.toLowerCase()} successfully.`,
      property: {
        id: property._id,
        verificationStatus: property.verificationStatus,
        verifiedAt: property.verifiedAt,
        verifiedBy: property.verifiedBy,
        listingStatus: property.listingStatus,
        isPublished: property.isPublished,
      },
    });
  } catch (error) {
    console.error(
      "Update property verification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update property verification.",
    });
  }
};

// ==========================================
// PUBLISH PROPERTY
// ==========================================

const publishProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (property.verificationStatus !== "VERIFIED") {
      return res.status(400).json({
        success: false,
        message:
          "Property must be verified before it can be published.",
      });
    }

    property.listingStatus = "PUBLISHED";
    property.isPublished = true;
    property.publishedAt = new Date();

    await property.save();

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_PUBLISHED",
      resource: "Property",
      resourceId: property._id,
      details: "Property published publicly.",
    });

    return res.status(200).json({
      success: true,
      message: "Property published successfully.",
      property: {
        id: property._id,
        title: property.title,
        listingStatus: property.listingStatus,
        verificationStatus: property.verificationStatus,
        isPublished: property.isPublished,
        publishedAt: property.publishedAt,
      },
    });
  } catch (error) {
    console.error("Publish property error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to publish property.",
    });
  }
};

// ==========================================
// UNPUBLISH PROPERTY
// ==========================================

const unpublishProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    property.listingStatus = "DRAFT";
    property.isPublished = false;
    property.publishedAt = null;

    await property.save();

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_UNPUBLISHED",
      resource: "Property",
      resourceId: property._id,
      details: "Property removed from public listings.",
    });

    return res.status(200).json({
      success: true,
      message: "Property unpublished successfully.",
      property: {
        id: property._id,
        listingStatus: property.listingStatus,
        isPublished: property.isPublished,
      },
    });
  } catch (error) {
    console.error("Unpublish property error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to unpublish property.",
    });
  }
};

// ==========================================
// UPDATE PROPERTY
// ==========================================

const updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    const {
      title,
      description,
      propertyType,
      listingType,
      price,
      currency,
      address,
      location,
      images,
      videos,
      bedrooms,
      bathrooms,
      landSize,
      isFeatured,
    } = req.body;

    // ==========================================
    // VALIDATE GPS LOCATION
    // ==========================================

    if (location !== undefined) {
      if (
        !location ||
        !Array.isArray(location.coordinates) ||
        location.coordinates.length !== 2
      ) {
        return res.status(400).json({
          success: false,
          message:
            "GPS coordinates must contain longitude and latitude.",
        });
      }

      const [longitude, latitude] = location.coordinates;

      if (
        typeof longitude !== "number" ||
        typeof latitude !== "number" ||
        longitude < -180 ||
        longitude > 180 ||
        latitude < -90 ||
        latitude > 90
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid GPS coordinates.",
        });
      }

      property.location = {
        type: "Point",
        coordinates: [longitude, latitude],
      };
    }

    // ==========================================
    // UPDATE PROPERTY INFORMATION
    // ==========================================

    if (title !== undefined) {
      property.title = title;
    }

    if (description !== undefined) {
      property.description = description;
    }

    if (propertyType !== undefined) {
      property.propertyType = propertyType;
    }

    if (listingType !== undefined) {
      property.listingType = listingType;
    }

    if (price !== undefined) {
      property.price = price;
    }

    if (currency !== undefined) {
      property.currency = currency;
    }

    if (address !== undefined) {
      property.address = address;
    }

    if (images !== undefined) {
      property.images = Array.isArray(images) ? images : [];
    }

    if (videos !== undefined) {
      property.videos = Array.isArray(videos) ? videos : [];
    }

    if (bedrooms !== undefined) {
      property.bedrooms = bedrooms;
    }

    if (bathrooms !== undefined) {
      property.bathrooms = bathrooms;
    }

    if (landSize !== undefined) {
      property.landSize = landSize;
    }

    if (isFeatured !== undefined) {
      property.isFeatured = Boolean(isFeatured);
    }

    // ==========================================
    // IMPORTANT:
    // ANY PROPERTY UPDATE REQUIRES
    // RE-VERIFICATION BEFORE REPUBLISHING
    // ==========================================

    property.verificationStatus = "PENDING";
    property.verifiedAt = null;
    property.verifiedBy = null;

    property.listingStatus = "DRAFT";
    property.isPublished = false;
    property.publishedAt = null;

    await property.save();

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_UPDATED",
      resource: "Property",
      resourceId: property._id,
      details:
        "Property information updated and property returned to draft for re-verification.",
    });

    return res.status(200).json({
      success: true,
      message:
        "Property updated successfully and returned to draft for re-verification.",
      property: {
        id: property._id,
        title: property.title,
        propertyType: property.propertyType,
        listingType: property.listingType,
        price: property.price,
        currency: property.currency,
        listingStatus: property.listingStatus,
        verificationStatus: property.verificationStatus,
        isPublished: property.isPublished,
      },
    });
  } catch (error) {
    console.error("Update property error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update property.",
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  createProperty,
  getPublicProperties,
  getPublicPropertyById,
  getStaffProperties,
  submitPropertyForReview,
  updatePropertyVerification,
  publishProperty,
  unpublishProperty,
  updateProperty,
};

