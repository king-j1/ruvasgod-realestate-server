const path = require("path");

const cloudinary = require("../config/cloudinary");
const PropertyOwnerDocument = require("../models/PropertyOwnerDocument");
const PropertyOwnerStaffAccess = require(
  "../models/PropertyOwnerStaffAccess"
);
const PropertyOwner = require("../models/PropertyOwner");

const { logAudit } = require("../services/auditService");

// CHECK OWNER ACCESS
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

// UPLOAD OWNER DOCUMENT
const uploadOwnerDocument = async (req, res) => {
  try {
    const {
      ownerRecord,
      documentType,
      documentName,
    } = req.body;

    if (!ownerRecord || !documentType || !documentName) {
      return res.status(400).json({
        success: false,
        message:
          "Owner record, document type, and document name are required.",
      });
    }

    const accessCheck = await checkOwnerAccess({
      userId: req.user._id,
      ownerRecord,
      permission: "canUploadDocuments",
    });

    if (!accessCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: accessCheck.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Document file is required.",
      });
    }

    const owner = await PropertyOwner.findById(ownerRecord);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Property owner not found.",
      });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder:
            "ruvasgod-realestate/private-owner-documents",
          resource_type: "auto",
          type: "authenticated",
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      stream.end(req.file.buffer);
    });

    const document = await PropertyOwnerDocument.create({
      ownerRecord: owner._id,
      documentType,
      documentName,
      fileUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
    });

    await logAudit({
      user: req.user._id,
      action: "OWNER_DOCUMENT_UPLOADED",
      resource: "PropertyOwnerDocument",
      resourceId: document._id,
      details: `Uploaded ${documentType} for property owner ${owner._id}`,
    });

    return res.status(201).json({
      success: true,
      message: "Owner document uploaded successfully.",
      document: {
        id: document._id,
        ownerRecord: document.ownerRecord,
        documentType: document.documentType,
        documentName: document.documentName,
        verificationStatus: document.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Upload owner document error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload owner document.",
    });
  }
};

// LIST OWNER DOCUMENTS
const getOwnerDocuments = async (req, res) => {
  try {
    const ownerId = req.params.ownerId;

    const accessCheck = await checkOwnerAccess({
      userId: req.user._id,
      ownerRecord: ownerId,
      permission: "canViewDocuments",
    });

    if (!accessCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: accessCheck.message,
      });
    }

    const documents = await PropertyOwnerDocument.find({
      ownerRecord: ownerId,
      isActive: true,
    })
      .select("-fileUrl -publicId")
      .populate("uploadedBy", "name email role")
      .populate("reviewedBy", "name email role")
      .sort({ createdAt: -1 });

    await logAudit({
      user: req.user._id,
      action: "OWNER_DOCUMENTS_VIEWED",
      resource: "PropertyOwner",
      resourceId: ownerId,
      details: "Viewed owner document records.",
    });

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error("Get owner documents error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch owner documents.",
    });
  }
};

// VERIFY OWNER DOCUMENT
const verifyOwnerDocument = async (req, res) => {
  try {
    const {
      verificationStatus,
      rejectionReason,
    } = req.body;

    const allowedStatuses = [
      "UNDER_REVIEW",
      "VERIFIED",
      "REJECTED",
    ];

    if (!allowedStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document verification status.",
      });
    }

    const document = await PropertyOwnerDocument.findById(
      req.params.id
    );

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: "Owner document not found.",
      });
    }

    const accessCheck = await checkOwnerAccess({
      userId: req.user._id,
      ownerRecord: document.ownerRecord,
      permission: "canVerifyDocuments",
    });

    if (!accessCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: accessCheck.message,
      });
    }

    document.verificationStatus = verificationStatus;
    document.reviewedBy = req.user._id;
    document.reviewedAt = new Date();

    if (verificationStatus === "REJECTED") {
      document.rejectionReason =
        rejectionReason || "Document rejected.";
    } else {
      document.rejectionReason = null;
    }

    await document.save();

    await logAudit({
      user: req.user._id,
      action: "OWNER_DOCUMENT_VERIFICATION_UPDATED",
      resource: "PropertyOwnerDocument",
      resourceId: document._id,
      details: `Document status changed to ${verificationStatus}`,
    });

    return res.status(200).json({
      success: true,
      message: "Owner document verification updated.",
      document: {
        id: document._id,
        verificationStatus: document.verificationStatus,
        reviewedBy: document.reviewedBy,
        reviewedAt: document.reviewedAt,
        rejectionReason: document.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Verify owner document error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update document verification.",
    });
  }
};

// SECURE DOCUMENT DOWNLOAD
const downloadOwnerDocument = async (req, res) => {
  try {
    const document = await PropertyOwnerDocument.findById(
      req.params.id
    );

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: "Owner document not found.",
      });
    }

    const accessCheck = await checkOwnerAccess({
      userId: req.user._id,
      ownerRecord: document.ownerRecord,
      permission: "canDownloadDocuments",
    });

    if (!accessCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: accessCheck.message,
      });
    }

    let format = "pdf";

    if (document.mimeType) {
      const mimeExtension = document.mimeType.split("/")[1];

      if (mimeExtension) {
        format = mimeExtension === "jpeg"
          ? "jpg"
          : mimeExtension;
      }
    }

    if (!format) {
      const extension = path
        .extname(document.documentName)
        .replace(".", "");

      format = extension || "pdf";
    }

    const expiresAt =
      Math.floor(Date.now() / 1000) + 300;

    const secureUrl =
      cloudinary.utils.private_download_url(
        document.publicId,
        format,
        {
          resource_type:
            document.mimeType === "application/pdf"
              ? "raw"
              : "image",
          type: "authenticated",
          expires_at: expiresAt,
          attachment: false,
        }
      );

    await logAudit({
      user: req.user._id,
      action: "OWNER_DOCUMENT_ACCESSED",
      resource: "PropertyOwnerDocument",
      resourceId: document._id,
      details:
        "Secure temporary access URL generated for owner document.",
    });

    return res.status(200).json({
      success: true,
      message: "Secure document access granted.",
      document: {
        id: document._id,
        documentName: document.documentName,
        documentType: document.documentType,
        mimeType: document.mimeType,
      },
      access: {
        url: secureUrl,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Download owner document error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate secure document access.",
    });
  }
};

module.exports = {
  uploadOwnerDocument,
  getOwnerDocuments,
  verifyOwnerDocument,
  downloadOwnerDocument,
};