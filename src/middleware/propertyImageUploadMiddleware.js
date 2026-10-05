
const multer = require("multer");

const storage = multer.memoryStorage();

const propertyImageUpload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only JPG, JPEG, PNG, and WEBP property images are allowed."
        ),
        false
      );
    }
  },
});

const uploadPropertyImageFields = propertyImageUpload.fields([
  { name: "images", maxCount: 10 },
  { name: "images[]", maxCount: 10 },
]);

const uploadPropertyImages = (req, res, next) => {
  uploadPropertyImageFields(req, res, (error) => {
    if (error) {
      return next(error);
    }

    req.files = [
      ...(req.files?.images || []),
      ...(req.files?.["images[]"] || []),
    ];

    next();
  });
};

module.exports = uploadPropertyImages;

