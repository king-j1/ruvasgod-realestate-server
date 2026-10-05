const PropertyOwner = require("../models/PropertyOwner");
const PropertyOwnerDocument = require("../models/PropertyOwnerDocument");
const { logAudit } = require("../services/auditService");

// ==========================================
// CREATE PROPERTY OWNER
// ==========================================

const createPropertyOwner = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      identificationType,
      identificationNumber,
      ownerType,
      companyName,
      internalNotes,
    } = req.body;

    if (!firstName || !lastName || !phone) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, and phone are required.",
      });
    }

    const propertyOwner = await PropertyOwner.create({
      firstName,
      lastName,
      phone,
      email,
      identificationType,
      identificationNumber,
      ownerType,
      companyName,
      internalNotes,
    });

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_OWNER_CREATED",
      resource: "PropertyOwner",
      resourceId: propertyOwner._id,
      details: "Property owner record created.",
    });

    return res.status(201).json({
      success: true,
      message: "Property owner created successfully.",
      owner: {
        id: propertyOwner._id,
        firstName: propertyOwner.firstName,
        lastName: propertyOwner.lastName,
        ownerType: propertyOwner.ownerType,
        verificationStatus: propertyOwner.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Create property owner error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create property owner.",
    });
  }
};

// ==========================================
// GET PRIVATE PROPERTY OWNER
// ==========================================

const getPropertyOwner = async (req, res) => {
  try {
    const owner = await PropertyOwner.findById(req.params.id);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Property owner not found.",
      });
    }

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_OWNER_VIEWED",
      resource: "PropertyOwner",
      resourceId: owner._id,
      details: "Private property owner information viewed.",
    });

    return res.status(200).json({
      success: true,
      owner,
    });
  } catch (error) {
    console.error("Get property owner error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch property owner.",
    });
  }
};

// ==========================================
// VERIFY / REJECT PROPERTY OWNER
// ==========================================

const updatePropertyOwnerVerification = async (req, res) => {
  try {
    const { verificationStatus } = req.body;

    const allowedStatuses = [
      "UNDER_REVIEW",
      "VERIFIED",
      "REJECTED",
      "SUSPENDED",
    ];

    if (!allowedStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property owner verification status.",
      });
    }

    const owner = await PropertyOwner.findById(req.params.id);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Property owner not found.",
      });
    }

    if (verificationStatus === "VERIFIED") {
      if (!owner.identificationType || !owner.identificationNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Property owner identification information is required before verification.",
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
            "At least one verified owner document is required before the owner can be verified.",
        });
      }

      owner.verificationStatus = "VERIFIED";
      owner.verifiedBy = req.user._id;
      owner.verifiedAt = new Date();
    }

    if (verificationStatus === "UNDER_REVIEW") {
      owner.verificationStatus = "UNDER_REVIEW";
      owner.verifiedBy = null;
      owner.verifiedAt = null;
    }

    if (verificationStatus === "REJECTED") {
      owner.verificationStatus = "REJECTED";
      owner.verifiedBy = req.user._id;
      owner.verifiedAt = null;
    }

    if (verificationStatus === "SUSPENDED") {
      owner.verificationStatus = "SUSPENDED";
      owner.verifiedBy = req.user._id;
      owner.verifiedAt = null;
    }

    await owner.save();

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_OWNER_VERIFICATION_UPDATED",
      resource: "PropertyOwner",
      resourceId: owner._id,
      details: `Property owner verification changed to ${verificationStatus}.`,
    });

    return res.status(200).json({
      success: true,
      message: `Property owner ${verificationStatus.toLowerCase()} successfully.`,
      owner: {
        id: owner._id,
        firstName: owner.firstName,
        lastName: owner.lastName,
        ownerType: owner.ownerType,
        verificationStatus: owner.verificationStatus,
        verifiedBy: owner.verifiedBy,
        verifiedAt: owner.verifiedAt,
      },
    });
  } catch (error) {
    console.error("Update property owner verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update property owner verification.",
    });
  }
};

module.exports = {
  createPropertyOwner,
  getPropertyOwner,
  updatePropertyOwnerVerification,
};