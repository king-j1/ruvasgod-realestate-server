// Reusable staff role guard. Must run after `protect` has attached req.user.
const staffOnly = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient staff permissions.",
      });
    }

    next();
  };
};

module.exports = staffOnly;
