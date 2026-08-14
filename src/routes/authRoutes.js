const express = require("express");

const {
  register,
  login,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// Register
router.post("/register", register);

// Login
router.post("/login", login);

// Get current logged-in user
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// Admin-only test route
router.get("/admin-test", protect, adminOnly, (req, res) => {
  res.json({
    success: true,
    message: "Welcome Admin",
    user: req.user,
  });
});

module.exports = router;