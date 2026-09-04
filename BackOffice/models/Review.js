const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
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
    courierUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    supermarketRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    supermarketComment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    courierRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    courierComment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ supermarketId: 1, createdAt: -1 });
reviewSchema.index({ courierUserId: 1, createdAt: -1 });
reviewSchema.index({ clientUserId: 1, orderId: 1 });

module.exports = mongoose.model("Review", reviewSchema);