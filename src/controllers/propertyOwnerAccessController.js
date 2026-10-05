const PropertyOwnerStaffAccess = require(
  "../models/PropertyOwnerStaffAccess"
);

const PropertyOwner = require("../models/PropertyOwner");

const User = require("../models/User");

const { logAudit } = require("../services/auditService");

// ==========================================
// ASSIGN STAFF TO PROPERTY OWNER
// ==========================================

const assignStaffToPropertyOwner = async (req, res) => {
  try {
    const {
      staffId,
      ownerRecord,
      canViewOwner,
      canViewDocuments,
      canUploadDocuments,
      canVerifyDocuments,
      canDownloadDocuments,
    } = req.body;

    if (!staffId || !ownerRecord) {
      return res.status(400).json({
        success: false,
        message: "Staff ID and owner record are required.",
      });
    }

    const staff = await User.findById(staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found.",
      });
    }

    if (staff.role === "customer") {
      return res.status(400).json({
        success: false,
        message: "A customer cannot be assigned owner access.",
      });
    }

    const owner = await PropertyOwner.findById(ownerRecord);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Property owner not found.",
      });
    }

    const access = await PropertyOwnerStaffAccess.findOneAndUpdate(
      {
        staff: staff._id,
        ownerRecord: owner._id,
      },
      {
        staff: staff._id,
        ownerRecord: owner._id,

        canViewOwner: Boolean(canViewOwner),
        canViewDocuments: Boolean(canViewDocuments),
        canUploadDocuments: Boolean(canUploadDocuments),
        canVerifyDocuments: Boolean(canVerifyDocuments),
        canDownloadDocuments: Boolean(canDownloadDocuments),

        assignedBy: req.user._id,

        isActive: true,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_OWNER_STAFF_ACCESS_ASSIGNED",
      resource: "PropertyOwnerStaffAccess",
      resourceId: access._id,
      details: `Staff ${staff._id} assigned to property owner ${owner._id}.`,
    });

    return res.status(200).json({
      success: true,
      message: "Staff access assigned successfully.",
      access: {
        id: access._id,
        staff: access.staff,
        ownerRecord: access.ownerRecord,
        canViewOwner: access.canViewOwner,
        canViewDocuments: access.canViewDocuments,
        canUploadDocuments: access.canUploadDocuments,
        canVerifyDocuments: access.canVerifyDocuments,
        canDownloadDocuments: access.canDownloadDocuments,
        isActive: access.isActive,
      },
    });
  } catch (error) {
    console.error("Assign staff owner access error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign staff access.",
    });
  }
};

// ==========================================
// GET STAFF ASSIGNMENTS FOR OWNER
// ==========================================

const getOwnerStaffAccess = async (req, res) => {
  try {
    const access = await PropertyOwnerStaffAccess.find({
      ownerRecord: req.params.ownerId,
      isActive: true,
    })
      .populate("staff", "name email role")
      .populate("assignedBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: access.length,
      access,
    });
  } catch (error) {
    console.error("Get owner staff access error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch owner staff access.",
    });
  }
};

// ==========================================
// REVOKE STAFF ACCESS
// ==========================================

const revokeStaffOwnerAccess = async (req, res) => {
  try {
    const access = await PropertyOwnerStaffAccess.findById(
      req.params.id
    );

    if (!access) {
      return res.status(404).json({
        success: false,
        message: "Staff access record not found.",
      });
    }

    access.isActive = false;

    await access.save();

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_OWNER_STAFF_ACCESS_REVOKED",
      resource: "PropertyOwnerStaffAccess",
      resourceId: access._id,
      details: "Staff access to property owner was revoked.",
    });

    return res.status(200).json({
      success: true,
      message: "Staff access revoked successfully.",
    });
  } catch (error) {
    console.error("Revoke owner staff access error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to revoke staff access.",
    });
  }
};

module.exports = {
  assignStaffToPropertyOwner,
  getOwnerStaffAccess,
  revokeStaffOwnerAccess,
};