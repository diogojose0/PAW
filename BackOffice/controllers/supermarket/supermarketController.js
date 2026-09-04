const Product = require("../../models/Product");
const Order = require("../../models/Order");
const Review = require("../../models/Review");

function renderSettingsView(res, supermarket, options = {}) {
  return res.status(options.statusCode || 200).render("supermarket/settings", {
    title: "Supermarket Settings",
    supermarket,
    error: options.error || null,
  });
}

function parseCoordinate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return NaN;
  }

  return parsed;
}

function hasValidCoordinates(coordinates) {
  return (
    coordinates &&
    Number.isFinite(Number(coordinates.lat)) &&
    Number.isFinite(Number(coordinates.lng))
  );
}

const supermarketController = {};

supermarketController.dashboard = async function (req, res, next) {
  try {
    const supermarket = req.supermarket;

    const [
      productsCount,
      activeProductsCount,
      ordersCount,
      ordersByStatusRaw,
      deliveredRevenueRaw,
      topProducts,
      recentOrders,
      recentReviews,
      reviewStatsRaw,
    ] = await Promise.all([
      Product.countDocuments({ supermarketId: supermarket._id }),
      Product.countDocuments({
        supermarketId: supermarket._id,
        active: true,
      }),
      Order.countDocuments({ supermarketId: supermarket._id }),
      Order.aggregate([
        {
          $match: {
            supermarketId: supermarket._id,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            supermarketId: supermarket._id,
            status: "delivered",
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$finalTotal" },
            deliveredOrders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            supermarketId: supermarket._id,
            status: "delivered",
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            name: { $first: "$items.nameSnapshot" },
            quantitySold: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.subtotal" },
          },
        },
        { $sort: { quantitySold: -1, revenue: -1 } },
        { $limit: 5 },
      ]),
      Order.find({ supermarketId: supermarket._id })
        .populate("clientUserId", "name")
        .sort({ createdAt: -1 })
        .limit(5),

      Review.find({ supermarketId: supermarket._id })
        .populate("clientUserId", "name email")
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),

      Review.aggregate([
        {
          $match: {
            supermarketId: supermarket._id,
          },
        },
        {
          $group: {
            _id: "$supermarketId",
            averageRating: { $avg: "$supermarketRating" },
            reviewCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const ordersByStatus = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      delivering: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const item of ordersByStatusRaw) {
      ordersByStatus[item._id] = item.count;
    }

    const deliveredRevenue = deliveredRevenueRaw[0] || {
      revenue: 0,
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

    res.render("supermarket/dashboard", {
      title: "Supermarket Dashboard",
      supermarket,
      stats: {
        productsCount,
        activeProductsCount,
        ordersCount,
        deliveredOrdersCount: deliveredRevenue.deliveredOrders || 0,
        deliveredRevenue: deliveredRevenue.revenue || 0,
      },
      ordersByStatus,
      topProducts,
      recentOrders,
      reviewStats,
      recentReviews,
    });
  } catch (err) {
    next(err);
  }
};

supermarketController.settingsForm = async function (req, res, next) {
  try {
    const supermarketData = req.supermarket.toObject();

    if (!hasValidCoordinates(supermarketData.coordinates)) {
      supermarketData.coordinates = {
        lat: null,
        lng: null,
      };
    }

    return renderSettingsView(res, supermarketData);
  } catch (err) {
    next(err);
  }
};

supermarketController.updateSettings = async function (req, res, next) {
  try {
    const {
      name,
      description,
      location,
      openingHours,
      deliveryMethods,
      deliveryCosts,
      coordinates,
      submitAction,
    } = req.body;

    const normalizedDeliveryMethods = Array.isArray(deliveryMethods)
      ? deliveryMethods
      : deliveryMethods
        ? [deliveryMethods]
        : [];

    const parsedLat = parseCoordinate(coordinates?.lat);
    const parsedLng = parseCoordinate(coordinates?.lng);

    const supermarketData = {
      ...req.supermarket.toObject(),
      name: name?.trim() || "",
      description: description?.trim() || "",
      location: location?.trim() || "",
      openingHours: openingHours?.trim() || "",
      deliveryMethods: normalizedDeliveryMethods,
      deliveryCosts: {
        pickup: Number(deliveryCosts?.pickup || 0),
        courier: Number(deliveryCosts?.courier || 0),
      },
      coordinates: {
        lat: parsedLat,
        lng: parsedLng,
      },
    };

    if (
      !supermarketData.name ||
      !supermarketData.location ||
      !supermarketData.openingHours
    ) {
      return renderSettingsView(res, supermarketData, {
        statusCode: 400,
        error: "You must fill in all the required fields.",
      });
    }

    if (
      supermarketData.deliveryCosts.pickup < 0 ||
      supermarketData.deliveryCosts.courier < 0
    ) {
      return renderSettingsView(res, supermarketData, {
        statusCode: 400,
        error: "Delivery costs cannot be negative.",
      });
    }

    const hasOnlyOneCoordinate =
      (parsedLat === null && parsedLng !== null) ||
      (parsedLat !== null && parsedLng === null);

    if (hasOnlyOneCoordinate) {
      return renderSettingsView(res, supermarketData, {
        statusCode: 400,
        error: "You must define both latitude and longitude, or neither.",
      });
    }

    if (
      parsedLat !== null &&
      (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90)
    ) {
      return renderSettingsView(res, supermarketData, {
        statusCode: 400,
        error: "Latitude must be a valid number between -90 and 90.",
      });
    }

    if (
      parsedLng !== null &&
      (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180)
    ) {
      return renderSettingsView(res, supermarketData, {
        statusCode: 400,
        error: "Longitude must be a valid number between -180 and 180.",
      });
    }

    req.supermarket.name = supermarketData.name;
    req.supermarket.description = supermarketData.description;
    req.supermarket.location = supermarketData.location;
    req.supermarket.openingHours = supermarketData.openingHours;
    req.supermarket.deliveryMethods = supermarketData.deliveryMethods;
    req.supermarket.deliveryCosts = supermarketData.deliveryCosts;
    req.supermarket.coordinates = {
      lat: parsedLat,
      lng: parsedLng,
    };

    if (
      submitAction === "resubmit" &&
      req.supermarket.approvalStatus === "rejected"
    ) {
      req.supermarket.approvalStatus = "pending";
      req.supermarket.approvedByAdmin = false;
      req.supermarket.rejectionReason = "";
      req.supermarket.rejectedAt = null;
      req.supermarket.approvedAt = null;
      req.supermarket.reviewedByAdminUserId = null;

      await req.supermarket.save();

      req.session.flash = {
        type: "success",
        text: "Your supermarket request was submitted again and is now pending admin approval.",
      };

      return res.redirect("/supermarket");
    }

    await req.supermarket.save();

    req.session.flash = {
      type: "success",
      text: "Supermarket settings updated successfully.",
    };

    res.redirect("/supermarket");
  } catch (err) {
    next(err);
  }
};

module.exports = supermarketController;
