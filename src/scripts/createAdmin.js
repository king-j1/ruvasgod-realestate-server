const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

const connectDB = require("../config/db");
const User = require("../models/User");

dotenv.config();

const createAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = "admin@ruvasgodauto.com";
    const adminPassword = "ChangeThisPassword123!";

    const existingAdmin = await User.findOne({
      email: adminEmail,
    });

    if (existingAdmin) {
      console.log("Admin account already exists.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      adminPassword,
      12
    );

    const admin = await User.create({
      name: "Ruvasgod Auto Admin",
      email: adminEmail,
      phone: "0240000000",
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin account created successfully.");
    console.log(`Email: ${admin.email}`);
    console.log("Please change the password before production.");

    process.exit(0);
  } catch (error) {
    console.error("Failed to create admin:", error.message);
    process.exit(1);
  }
};

createAdmin();