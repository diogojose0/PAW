const Delivery = require("../../models/Delivery");
const Review = require("../../models/Review");

const courierController = {};

courierController.dashboard = async function (req, res, next) {
  try {
    const courierId = req.user._id;

    const [
      availableCount,
      myCount,
      activeCount,
      deliveredCount,
      deliveredEarningsRaw,
      myDeliveriesByStatusRaw,
      topSupermarkets,
      recentDeliveries,
      recentReviews,
      reviewStatsRaw,
    ] = await Promise.all([
      Delivery.countDocuments({
        status: "available",
        courierUserId: null,
      }),
      Delivery.countDocuments({
        courierUserId: courierId,
      }),
      Delivery.countDocuments({
        courierUserId: courierId,
        status: { $in: ["accepted", "picked_up"] },
      }),
      Delivery.countDocuments({
        courierUserId: courierId,
        status: "delivered",
      }),
      Delivery.aggregate([
        {
          $match: {
            courierUserId: courierId,
            status: "delivered",
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: "$order" },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: "$order.deliveryCost" },
            deliveredOrders: { $sum: 1 },
          },
        },
      ]),
      Delivery.aggregate([
        {
          $match: {
            courierUserId: courierId,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Delivery.aggregate([
        {
          $match: {
            courierUserId: courierId,
            status: "delivered",
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: "$order" },
        {
          $lookup: {
            from: "supermarkets",
            localField: "order.supermarketId",
            foreignField: "_id",
            as: "supermarket",
          },
        },
        { $unwind: "$supermarket" },
        {
          $group: {
            _id: "$supermarket._id",
            supermarketName: { $first: "$supermarket.name" },
            deliveries: { $sum: 1 },
          },
        },
        { $sort: { deliveries: -1, supermarketName: 1 } },
        { $limit: 5 },
      ]),
      Delivery.find({ courierUserId: courierId })
        .populate({
          path: "orderId",
          populate: [
            {
              path: "supermarketId",
              select: "name",
            },
            {
              path: "clientUserId",
              select: "name",
            },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(5),

      Review.find({
        courierUserId: courierId,
        courierRating: { $ne: null },
      })
        .populate("clientUserId", "name email")
        .populate("supermarketId", "name")
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),

      Review.aggregate([
        {
          $match: {
            courierUserId: courierId,
            courierRating: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$courierUserId",
            averageRating: { $avg: "$courierRating" },
            reviewCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const myDeliveriesByStatus = {
      available: 0,
      accepted: 0,
      picked_up: 0,
      delivered: 0,
      pending: 0,
    };

    for (const item of myDeliveriesByStatusRaw) {
      myDeliveriesByStatus[item._id] = item.count;
    }

    const deliveredEarnings = deliveredEarningsRaw[0] || {
      totalEarnings: 0,
      deliveredOrders: 0,
    };

    const reviewStatsResult = reviewStatsRaw[0] || {
      averageRating: 0,
      reviewCount: 0,
    };

    const reviewStats = {
      averageRating: reviewStatsResult.averageRating
        ? Math.round(reviewStatsResult.averageRating * 10) / 10
        : 0,
      reviewCount: reviewStatsResult.reviewCount || 0,
    };

    res.render("courier/dashboard", {
      title: "Courier Dashboard",
      stats: {
        availableCount,
        myCount,
        activeCount,
        deliveredCount,
        totalEarnings: deliveredEarnings.totalEarnings || 0,
        deliveredOrdersCount: deliveredEarnings.deliveredOrders || 0,
      },
      myDeliveriesByStatus,
      topSupermarkets,
      recentDeliveries,
      reviewStats,
      recentReviews,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = courierController;
