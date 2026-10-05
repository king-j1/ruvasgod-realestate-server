const PropertyOwnerStaffAccess = require(
  "../models/PropertyOwnerStaffAccess"
);

const requireOwnerAccess = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authorized.",
        });
      }

      const ownerId =
        req.params.ownerId ||
        req.params.id ||
        req.body.ownerRecord;

      if (!ownerId) {
        return res.status(400).json({
          success: false,
          message: "Property owner ID is required.",
        });
      }

      const access = await PropertyOwnerStaffAccess.findOne({
        staff: req.user._id,
        ownerRecord: ownerId,
        isActive: true,
      });

      if (!access) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You are not assigned to this property owner.",
        });
      }

      if (!access[permission]) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You do not have the required permission.",
        });
      }

      req.ownerAccess = access;

      next();
    } catch (error) {
      console.error("Property owner access error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to verify property owner access.",
      });
    }
  };
};

module.exports = requireOwnerAccess;