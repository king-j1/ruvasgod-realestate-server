const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_]+$/,
    },

    phone: {
      type: String,
      required: false,
      trim: true,
    },

    password: {
      type: String,
      select: false,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },

    passwordResetTokenHash: {
      type: String,
      select: false,
    },

    passwordResetExpiresAt: {
      type: Date,
      select: false,
    },

    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },

    passwordChangedAt: {
      type: Date,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "customer",
        "admin",
        "manager",
        "sales",
        "rental",
        "finance",
        "vehicle_manager",
      ],
      default: "customer",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("validate", function () {
  if (this.isNew && !this.googleId && !this.password) {
    this.invalidate("password", "Password is required");
  }
});

module.exports = mongoose.model("User", userSchema);