const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const vehicleRoutes = require("./routes/vehicleRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Test Route
app.get("/", (req, res) => {
  res.json({
    message: "Ruvasgod Auto API is running 🚗",
  });
});

// Vehicle Routes
app.use("/api/vehicles", vehicleRoutes);

module.exports = app;