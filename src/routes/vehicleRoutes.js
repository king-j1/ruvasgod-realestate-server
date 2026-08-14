const express = require("express");

const {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} = require("../controllers/vehicleController");

const upload = require("../middleware/uploadMiddleware");
const { protect } = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// Create a vehicle — Admin only
router.post(
  "/",
  protect,
  adminOnly,
  upload.array("images", 10),
  createVehicle
);

// Get all vehicles — Public
router.get("/", getVehicles);

// Get one vehicle — Public
router.get("/:id", getVehicleById);

// Update a vehicle — Admin only
router.put(
  "/:id",
  protect,
  adminOnly,
  upload.array("images", 10),
  updateVehicle
);

// Delete a vehicle — Admin only
router.delete(
  "/:id",
  protect,
  adminOnly,
  deleteVehicle
);

module.exports = router;