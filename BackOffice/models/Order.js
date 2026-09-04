const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    nameSnapshot: { type: String, required: true },
    priceSnapshot: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    clientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    supermarketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      required: true,
    },
    items: [orderItemSchema],
    itemsTotal: { type: Number, required: true },

    couponCode: { type: String, default: null },
    discountType: {
      type: String,
      enum: ["fixed", "percent", "free_shipping", null],
      default: null,
    },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },

    deliveryMethod: {
      type: String,
      enum: ["pickup", "courier"],
      required: true,
    },
    deliveryCost: { type: Number, required: true, default: 0 },
    finalTotal: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["on_delivery", "stripe"],
      default: "on_delivery",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "unpaid", "paid", "failed"],
      default: "pending",
    },
    stripeCheckoutSessionId: {
      type: String,
      default: null,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "delivering",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    createdAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
