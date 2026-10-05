
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/db");

const vehicleRoutes = require("./routes/vehicleRoutes");
const authRoutes = require("./routes/authRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const saleRoutes = require("./routes/saleRoutes");
const staffRoutes = require("./routes/staffRoutes");

const propertyOwnerRoutes = require("./routes/propertyOwnerRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const propertyOwnerDocumentRoutes = require(
  "./routes/propertyOwnerDocumentRoutes"
);
const propertyOwnerAccessRoutes = require(
  "./routes/propertyOwnerAccessRoutes"
);
const propertyImageRoutes = require(
  "./routes/propertyImageRoutes"
);

const app = express();

const configuredOrigins = (
  process.env.CORS_ORIGINS || process.env.FRONTEND_URL || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "https://ruvasgod-auto.vercel.app",
  ...configuredOrigins,
];

connectDB();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    },
  })
);

app.use(helmet());
app.use(morgan("dev"));

/*
|--------------------------------------------------------------------------
| Payment webhook
|--------------------------------------------------------------------------
| This must remain before express.json() because the payment provider
| may require the raw request body for signature verification.
*/
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" })
);

/*
|--------------------------------------------------------------------------
| Body parsers
|--------------------------------------------------------------------------
| IMPORTANT:
| These must come BEFORE routes that need req.body.
*/
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
|--------------------------------------------------------------------------
| Existing routes
|--------------------------------------------------------------------------
*/
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/staff", staffRoutes);

/*
|--------------------------------------------------------------------------
| Real Estate routes
|--------------------------------------------------------------------------
*/
app.use("/api/property-owners", propertyOwnerRoutes);

app.use("/api/properties", propertyRoutes);

app.use(
  "/api/property-owner-documents",
  propertyOwnerDocumentRoutes
);

app.use(
  "/api/property-owner-access",
  propertyOwnerAccessRoutes
);

app.use(
  "/api/property-images",
  propertyImageRoutes
);

/*
|--------------------------------------------------------------------------
| API health check
|--------------------------------------------------------------------------
*/
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Ruvasgod Real Estate API is running",
  });
});

/*
|--------------------------------------------------------------------------
| Global error handler
|--------------------------------------------------------------------------
*/
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

