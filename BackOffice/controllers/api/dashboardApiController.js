const Order = require("../../models/Order");

const dashboardApiController = {};

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

dashboardApiController.getClientDashboard = async function (req, res, next) {
  try {
    const clientUserId = req.user._id;

    const totalOrders = await Order.countDocuments({
      clientUserId,
    });

    const cancelledOrders = await Order.countDocuments({
      clientUserId,
      status: "cancelled",
    });

    const activeOrders = await Order.countDocuments({
      clientUserId,
      status: {
        $in: ["pending", "confirmed", "preparing", "delivering"],
      },
    });

    const totalSpentResult = await Order.aggregate([
      {
        $match: {
          clientUserId,
          status: {
            $ne: "cancelled",
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: {
            $sum: "$finalTotal",
          },
        },
      },
    ]);

    const ordersByStatus = await Order.aggregate([
      {
        $match: {
          clientUserId,
        },
      },
      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
        },
      },
    ]);

    const mostPurchasedProducts = await Order.aggregate([
      {
        $match: {
          clientUserId,
          status: {
            $ne: "cancelled",
          },
        },
      },
      {
        $unwind: "$items",
      },
      {
        $group: {
          _id: "$items.nameSnapshot",
          quantity: {
            $sum: "$items.quantity",
          },
          totalSpent: {
            $sum: "$items.subtotal",
          },
        },
      },
      {
        $sort: {
          quantity: -1,
          totalSpent: -1,
          _id: 1,
        },
      },
      {
        $limit: 5,
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          quantity: 1,
          totalSpent: 1,
        },
      },
    ]);

    const recentOrders = await Order.find({
      clientUserId,
    })
      .populate("supermarketId", "name location")
      .select(
        "supermarketId itemsTotal deliveryMethod deliveryCost finalTotal status createdAt cancelledAt",
      )
      .sort({
        createdAt: -1,
      })
      .limit(5)
      .lean();

    return res.json({
      summary: {
        totalOrders,
        activeOrders,
        cancelledOrders,
        totalSpent: roundCurrency(totalSpentResult[0]?.totalSpent || 0),
      },
      ordersByStatus,
      mostPurchasedProducts: mostPurchasedProducts.map((product) => ({
        ...product,
        totalSpent: roundCurrency(product.totalSpent),
      })),
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = dashboardApiController;
