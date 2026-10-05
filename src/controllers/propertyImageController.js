
const cloudinary = require("../config/cloudinary");
const Property = require("../models/Property");

const { logAudit } = require("../services/auditService");

const getPropertyImagePublicId = (imageUrl) => {
  try {
    const parsedUrl = new URL(imageUrl);
    const cloudName = cloudinary.config().cloud_name;

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "res.cloudinary.com" ||
      !cloudName
    ) {
      return null;
    }

    const pathParts = parsedUrl.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));

    if (
      pathParts[0] !== cloudName ||
      pathParts[1] !== "image" ||
      pathParts[2] !== "upload" ||
      !/^v\d+$/.test(pathParts[3] || "")
    ) {
      return null;
    }

    const publicIdParts = pathParts.slice(4);
    const lastPartIndex = publicIdParts.length - 1;

    if (lastPartIndex < 0) {
      return null;
    }

    publicIdParts[lastPartIndex] = publicIdParts[lastPartIndex].replace(
      /\.[^/.]+$/,
      ""
    );

    const publicId = publicIdParts.join("/");

    if (
      !publicId.startsWith("ruvasgod-realestate/properties/") ||
      publicIdParts.some(
        (part) =>
          !part ||
          part.includes("/") ||
          part.includes("\\") ||
          part === "." ||
          part === ".."
      )
    ) {
      return null;
    }

    return publicId;
  } catch {
    return null;
  }
};

// ==========================================
// UPLOAD PROPERTY IMAGES
// ==========================================

const uploadPropertyImages = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one property image is required.",
      });
    }

    const uploadedImages = [];

    for (const file of req.files) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "ruvasgod-realestate/properties",
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        stream.end(file.buffer);
      });

      uploadedImages.push(uploadResult.secure_url);
    }

    property.images.push(...uploadedImages);

    // ==========================================
    // IMAGE CHANGES REQUIRE RE-VERIFICATION
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
      action: "PROPERTY_IMAGES_UPLOADED",
      resource: "Property",
      resourceId: property._id,
      details: `${uploadedImages.length} property image(s) uploaded.`,
    });

    return res.status(201).json({
      success: true,
      message: "Property images uploaded successfully.",
      property: {
        id: property._id,
        title: property.title,
        images: property.images,
        imageCount: property.images.length,
        listingStatus: property.listingStatus,
        verificationStatus: property.verificationStatus,
        isPublished: property.isPublished,
      },
    });
  } catch (error) {
    console.error("Upload property images error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload property images.",
    });
  }
};

// ==========================================
// DELETE ONE PROPERTY IMAGE
// ==========================================

const deletePropertyImage = async (req, res) => {
  try {
    const { id, imageIndex } = req.params;

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    const index = Number(imageIndex);

    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid image index.",
      });
    }

    if (!property.images || index >= property.images.length) {
      return res.status(404).json({
        success: false,
        message: "Property image not found.",
      });
    }

    const imageUrl = property.images[index];

    const uploadMarker = "/upload/";
    const uploadPosition = imageUrl.indexOf(uploadMarker);

    if (uploadPosition === -1) {
      return res.status(400).json({
        success: false,
        message: "Invalid Cloudinary image URL.",
      });
    }

    let publicId = imageUrl.substring(
      uploadPosition + uploadMarker.length
    );

    publicId = publicId.replace(/^v\d+\//, "");
    publicId = publicId.replace(/\.[^/.]+$/, "");

    const cloudinaryResult = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    if (
      cloudinaryResult.result !== "ok" &&
      cloudinaryResult.result !== "not found"
    ) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete property image from Cloudinary.",
      });
    }

    property.images.splice(index, 1);

    // ==========================================
    // IMAGE CHANGES REQUIRE RE-VERIFICATION
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
      action: "PROPERTY_IMAGE_DELETED",
      resource: "Property",
      resourceId: property._id,
      details: `Property image ${index + 1} deleted.`,
    });

    return res.status(200).json({
      success: true,
      message: "Property image deleted successfully.",
      property: {
        id: property._id,
        title: property.title,
        images: property.images,
        imageCount: property.images.length,
        listingStatus: property.listingStatus,
        verificationStatus: property.verificationStatus,
        isPublished: property.isPublished,
      },
    });
  } catch (error) {
    console.error("Delete property image error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete property image.",
    });
  }
};

// ==========================================
// DELETE ALL PROPERTY IMAGES
// ==========================================

const deleteAllPropertyImages = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (!property.images || property.images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "This property has no images to delete.",
      });
    }

    const imagesToDelete = [...property.images];

    // ==========================================
    // DELETE ALL IMAGES FROM CLOUDINARY
    // ==========================================

    for (const imageUrl of imagesToDelete) {
      const publicId = getPropertyImagePublicId(imageUrl);

      if (!publicId) {
        console.error(
          "Invalid Cloudinary image URL:",
          imageUrl
        );
        continue;
      }

      try {
        const cloudinaryResult =
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
          });

        if (
          cloudinaryResult.result !== "ok" &&
          cloudinaryResult.result !== "not found"
        ) {
          console.error(
            `Failed to delete Cloudinary image: ${publicId}`
          );
        }
      } catch (cloudinaryError) {
        console.error(
          `Cloudinary deletion error for ${publicId}:`,
          cloudinaryError.message
        );
      }
    }

    // ==========================================
    // CLEAR PROPERTY IMAGES
    // ==========================================

    property.images = [];

    // ==========================================
    // IMAGE CHANGES REQUIRE RE-VERIFICATION
    // ==========================================

    property.verificationStatus = "PENDING";
    property.verifiedAt = null;
    property.verifiedBy = null;

    property.listingStatus = "DRAFT";
    property.isPublished = false;
    property.publishedAt = null;

    await property.save();

    // ==========================================
    // AUDIT LOG
    // ==========================================

    await logAudit({
      user: req.user._id,
      action: "PROPERTY_ALL_IMAGES_DELETED",
      resource: "Property",
      resourceId: property._id,
      details: `${imagesToDelete.length} property image(s) deleted.`,
    });

    return res.status(200).json({
      success: true,
      message: "All property images deleted successfully.",
      property: {
        id: property._id,
        title: property.title,
        images: property.images,
        imageCount: property.images.length,
        listingStatus: property.listingStatus,
        verificationStatus: property.verificationStatus,
        isPublished: property.isPublished,
      },
    });
  } catch (error) {
    console.error("Delete all property images error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete all property images.",
    });
  }
};

module.exports = {
  uploadPropertyImages,
  deletePropertyImage,
  deleteAllPropertyImages,
};

