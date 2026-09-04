const User = require("../../models/User");
const Supermarket = require("../../models/Supermarket");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const Category = require("../../models/Category");

const adminController = {};

adminController.dashboard = async function (req, res, next) {
  try {
    const [
      usersCount,
      supermarketsCount,
      pendingSupermarketsCount,
      productsCount,
      ordersCount,
      categoriesCount,
      activeCategoriesCount,
      approvedSupermarkets,
      usersByRoleRaw,
      ordersByStatusRaw,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments(),
      Supermarket.countDocuments(),
      Supermarket.countDocuments({ approvalStatus: "pending" }),
      Product.countDocuments(),
      Order.countDocuments(),
      Category.countDocuments(),
      Category.countDocuments({ active: true }),
      Supermarket.find({ approvalStatus: "approved" })
        .select("name location coordinates approvedByAdmin approvalStatus")
        .sort({ name: 1 }),
      User.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Order.find()
        .populate("clientUserId", "name")
        .populate("supermarketId", "name")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const usersByRole = {
      admin: 0,
      supermarket: 0,
      courier: 0,
      client: 0,
    };

    for (const item of usersByRoleRaw) {
      usersByRole[item._id] = item.count;
    }

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

    const supermarketsMapData = approvedSupermarkets
      .filter(
        (supermarket) =>
          Number.isFinite(Number(supermarket.coordinates?.lat)) &&
          Number.isFinite(Number(supermarket.coordinates?.lng)),
      )
      .map((supermarket) => ({
        id: supermarket._id.toString(),
        name: supermarket.name,
        location: supermarket.location,
        lat: Number(supermarket.coordinates.lat),
        lng: Number(supermarket.coordinates.lng),
      }));

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats: {
        usersCount,
        supermarketsCount,
        pendingSupermarketsCount,
        productsCount,
        ordersCount,
        categoriesCount,
        activeCategoriesCount,
      },
      usersByRole,
      ordersByStatus,
      recentOrders,
      supermarketsMapData,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = adminController;
