const mongoose = require("mongoose");

const Delivery = require("../../models/Delivery");
const Order = require("../../models/Order");
const Review = require("../../models/Review");
const Supermarket = require("../../models/Supermarket");

const reviewApiController = {};

function parseRating(value, fieldName, required = true) {
  if ((value === null || value === undefined || value === "") && !required) {
    return {
      rating: null,
    };
  }

  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return {
      error: `${fieldName} must be an integer between 1 and 5.`,
    };
  }

  return {
    rating,
  };
}

function sanitizeComment(value) {
  return String(value || "")
    .trim()
    .slice(0, 500);
}

async function getDeliveredClientOrder(orderId, clientUserId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return {
      status: 400,
      message: "Invalid order ID.",
    };
  }

  const order = await Order.findOne({
    _id: orderId,
    clientUserId,
  }).lean();

  if (!order) {
    return {
      status: 404,
      message: "Order not found.",
    };
  }

  if (order.status !== "delivered") {
    return {
      status: 400,
      message: "Only delivered orders can be reviewed.",
    };
  }

  return {
    order,
  };
}

async function getCourierUserIdForOrder(order) {
  if (order.deliveryMethod !== "courier") {
    return null;
  }

  const delivery = await Delivery.findOne({
    orderId: order._id,
    status: "delivered",
  })
    .select("courierUserId")
    .lean();

  return delivery?.courierUserId || null;
}

reviewApiController.getOrderReview = async function (req, res, next) {
  try {
    const result = await getDeliveredClientOrder(
      req.params.orderId,
      req.user._id,
    );

    if (result.message) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    const review = await Review.findOne({
      orderId: result.order._id,
      clientUserId: req.user._id,
    }).lean();

    return res.json({
      canReview: true,
      review,
    });
  } catch (error) {
    next(error);
  }
};

reviewApiController.saveOrderReview = async function (req, res, next) {
  try {
    const result = await getDeliveredClientOrder(
      req.params.orderId,
      req.user._id,
    );

    if (result.message) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    const supermarketRatingResult = parseRating(
      req.body.supermarketRating,
      "Supermarket rating",
      true,
    );

    if (supermarketRatingResult.error) {
      return res.status(400).json({
        message: supermarketRatingResult.error,
      });
    }

    const courierUserId = await getCourierUserIdForOrder(result.order);

    const courierRatingResult = parseRating(
      req.body.courierRating,
      "Courier rating",
      false,
    );

    if (courierRatingResult.error) {
      return res.status(400).json({
        message: courierRatingResult.error,
      });
    }

    if (courierRatingResult.rating && !courierUserId) {
      return res.status(400).json({
        message: "This order does not have a delivered courier to review.",
      });
    }

    const review = await Review.findOneAndUpdate(
      {
        orderId: result.order._id,
        clientUserId: req.user._id,
      },
      {
        orderId: result.order._id,
        clientUserId: req.user._id,
        supermarketId: result.order.supermarketId,
        courierUserId,
        supermarketRating: supermarketRatingResult.rating,
        supermarketComment: sanitizeComment(req.body.supermarketComment),
        courierRating: courierRatingResult.rating,
        courierComment: courierRatingResult.rating
          ? sanitizeComment(req.body.courierComment)
          : "",
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean();

    return res.json({
      message: "Review saved successfully.",
      review,
    });
  } catch (error) {
    next(error);
  }
};

reviewApiController.listSupermarketReviews = async function (req, res, next) {
  try {
    const supermarketId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(supermarketId)) {
      return res.status(400).json({
        message: "Invalid supermarket ID.",
      });
    }

    const supermarket = await Supermarket.findOne({
      _id: supermarketId,
      approvedByAdmin: true,
    }).lean();

    if (!supermarket) {
      return res.status(404).json({
        message: "Supermarket not found.",
      });
    }

    const [stats] = await Review.aggregate([
      {
        $match: {
          supermarketId: new mongoose.Types.ObjectId(supermarketId),
        },
      },
      {
        $group: {
          _id: "$supermarketId",
          averageRating: {
            $avg: "$supermarketRating",
          },
          reviewCount: {
            $sum: 1,
          },
        },
      },
    ]);

    const reviews = await Review.find({
      supermarketId,
    })
      .populate("clientUserId", "name")
      .select(
        "clientUserId supermarketRating supermarketComment createdAt updatedAt",
      )
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.json({
      stats: {
        averageRating: stats ? Math.round(stats.averageRating * 10) / 10 : 0,
        reviewCount: stats?.reviewCount || 0,
      },
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = reviewApiController;
