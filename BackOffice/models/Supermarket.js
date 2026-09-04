const mongoose = require("mongoose");

const supermarketSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    location: { type: String, required: true },
    openingHours: { type: String, required: true },
    deliveryMethods: [
      {
        type: String,
        enum: ["pickup", "courier"],
      },
    ],
    deliveryCosts: {
      pickup: { type: Number, default: 0 },
      courier: { type: Number, default: 0 },
    },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedByAdmin: { type: Boolean, default: false },
    rejectionReason: { type: String, default: "" },
    rejectedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    reviewedByAdminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Supermarket", supermarketSchema);
