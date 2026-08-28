const express = require("express");

const {
  createSale,
  getMySales,
  getSaleById,
  getAllSales,
  updateSaleStatus,
} = require("../controllers/saleController");

const { protect } = require("../middleware/authMiddleware");
const staffOnly = require("../middleware/staffMiddleware");

const router = express.Router();

router.post("/", protect, createSale);

router.get("/my-sales", protect, getMySales);

router.get(
  "/admin",
  protect,
  staffOnly("admin", "manager", "sales", "finance"),
  getAllSales
);

router.put(
  "/admin/:id/status",
  protect,
  staffOnly("admin", "manager", "sales"),
  updateSaleStatus
);

router.get("/:id", protect, getSaleById);

module.exports = router;
