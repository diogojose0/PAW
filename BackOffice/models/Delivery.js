const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    courierUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "available", "accepted", "picked_up", "delivered"],
      default: "available",
    },
    acceptedAt: Date,
    deliveredAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Delivery", deliverySchema);