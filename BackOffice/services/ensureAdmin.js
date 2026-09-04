const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function ensureAdmin() {
  try {
    if (!process.env.ADMIN_NAME || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.log("ADMIN_EMAIL and ADMIN_PASSWORD must be defined in the .env file.");
      return;
    }

    const existingAdmin = await User.findOne({
      email: process.env.ADMIN_EMAIL.toLowerCase().trim(),
    });

    if (existingAdmin) {
      console.log("An admin with that email address already exists.");
      return;
    }

    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    await User.create({
      name: process.env.ADMIN_NAME.trim(),
      email: process.env.ADMIN_EMAIL.toLowerCase().trim(),
      passwordHash,
      address: "Admin Address",
      phone: "000000000",
      role: "admin",
      active: true,
    });

    console.log("Admin created successfully!");
  } catch (error) {
    console.error("Error creating admin!:", error.message);
  }
}

module.exports = ensureAdmin;