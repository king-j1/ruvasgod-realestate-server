const AuditLog = require("../models/AuditLog");

// Best-effort audit logging; a logging failure must never break the calling request.
const logAudit = async ({ user, action, resource, resourceId, details }) => {
  try {
    await AuditLog.create({
      user,
      action,
      resource,
      resourceId: resourceId ? resourceId.toString() : null,
      details: details || null,
    });
  } catch (error) {
    console.error("Audit log error:", error.message);
  }
};

module.exports = { logAudit };
