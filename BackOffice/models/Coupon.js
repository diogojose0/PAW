const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    supermarketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supermarket",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["fixed", "percent", "free_shipping"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    validFrom: {
      type: Date,
      default: null,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

couponSchema.index(
  { supermarketId: 1, code: 1 },
  { unique: true },
);

module.exports = mongoose.model("Coupon", couponSchema);