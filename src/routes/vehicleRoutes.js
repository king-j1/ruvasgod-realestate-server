const express = require("express");

const {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getAlternativeVehicles,
} = require("../controllers/vehicleController");

const upload = require("../middleware/uploadMiddleware");
const { protect } = require("../middleware/authMiddleware");
const staffOnly = require("../middleware/staffMiddleware");

const router = express.Router();

// Create a vehicle — Admin, Manager, Vehicle Manager
router.post(
  "/",
  protect,
  staffOnly("admin", "manager", "vehicle_manager"),
  upload.array("images", 10),
  createVehicle
);

// Get all vehicles — Public
router.get("/", getVehicles);

// Get alternative vehicles for given dates — Public
router.get("/:id/alternatives", getAlternativeVehicles);

// Get one vehicle — Public
router.get("/:id", getVehicleById);

// Update a vehicle — Admin, Manager, Vehicle Manager
router.put(
  "/:id",
  protect,
  staffOnly("admin", "manager", "vehicle_manager"),
  upload.array("images", 10),
  updateVehicle
);

// Delete a vehicle — Admin, Manager, Vehicle Manager
router.delete(
  "/:id",
  protect,
  staffOnly("admin", "manager", "vehicle_manager"),
  deleteVehicle
);

module.exports = router;