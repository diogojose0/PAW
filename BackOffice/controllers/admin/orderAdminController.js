const Order = require("../../models/Order");

const orderAdminController = {};

orderAdminController.ordersList = async function (req, res, next) {
  try {
    const status = (req.query.status || "").trim();

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate("clientUserId", "name email")
      .populate("supermarketId", "name location")
      .sort({ createdAt: -1 });

    res.render("admin/orders", {
      title: "Orders",
      orders,
      selectedStatus: status,
      statuses: [
        "pending",
        "confirmed",
        "preparing",
        "delivering",
        "delivered",
        "cancelled",
      ],
    });
  } catch (err) {
    next(err);
  }
};

orderAdminController.orderDetail = async function (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
      .populate("clientUserId", "name email phone address")
      .populate("supermarketId", "name location openingHours");

    if (!order) {
      req.session.flash = {
        type: "danger",
        text: "Order not found.",
      };
      return res.redirect("/admin/orders");
    }

    res.render("admin/order-detail", {
      title: "Order Detail",
      order,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = orderAdminController;