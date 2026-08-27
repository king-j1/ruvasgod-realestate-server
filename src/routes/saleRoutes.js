const express = require("express");

const {
  createSale,
  getMySales,
  getSaleById,
  getAllSales,
  updateSaleStatus,
} = require("../controllers/saleController");

const { protect } = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/", protect, createSale);

router.get("/my-sales", protect, getMySales);

router.get("/admin", protect, adminOnly, getAllSales);

router.put(
  "/admin/:id/status",
  protect,
  adminOnly,
  updateSaleStatus
);

router.get("/:id", protect, getSaleById);

module.exports = router;
