const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    make: {
      type: String,
      required: true,
      trim: true,
    },

    model: {
      type: String,
      required: true,
      trim: true,
    },

    year: {
      type: Number,
      required: true,
    },

    price: {
      type: Number,
      required: function () {
        return this.availableForSale === true;
      },
      min: 0,
    },

    rentalPricePerDay: {
      type: Number,
      min: 0,
    },

    type: {
      type: String,
      enum: ["SUV", "Sedan", "Pickup", "Sports", "Electric", "Luxury", "Van"],
      required: true,
    },

    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "Electric", "Hybrid"],
      required: true,
    },

    transmission: {
      type: String,
      enum: ["Automatic", "Manual"],
      required: true,
    },

    mileage: {
      type: Number,
      default: 0,
    },

    color: {
      type: String,
      trim: true,
    },

    condition: {
      type: String,
      enum: ["New", "Used"],
      required: true,
    },

    description: {
      type: String,
      trim: true,
    },

    images: [
      {
        type: String,
      },
    ],

    location: {
      type: String,
      trim: true,
    },

    availableForSale: {
      type: Boolean,
      default: true,
    },

    availableForRent: {
      type: Boolean,
      default: false,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    availabilityVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
