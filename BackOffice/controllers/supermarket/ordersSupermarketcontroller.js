const Order = require("../../models/Order");
const Delivery = require("../../models/Delivery");
const Product = require("../../models/Product");
const Coupon = require("../../models/Coupon");
const { sendOrderStatusEmail } = require("../../services/emailService");

const ordersSupermarketcontroller = {};

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "delivering",
  "delivered",
  "cancelled",
];

ordersSupermarketcontroller.ordersList = async function (req, res, next) {
  try {
    const status = (req.query.status || "").trim();

    const filter = {
      supermarketId: req.supermarket._id,
    };

    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate("clientUserId", "name email phone")
      .sort({ createdAt: -1 });

    res.render("supermarket/orders", {
      title: "Orders",
      supermarket: req.supermarket,
      orders,
      selectedStatus: status,
      statuses: ORDER_STATUSES,
    });
  } catch (err) {
    next(err);
  }
};

ordersSupermarketcontroller.orderDetail = async function (req, res, next) {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      supermarketId: req.supermarket._id,
    }).populate("clientUserId", "name email phone address");

    if (!order) {
      req.session.flash = {
        type: "danger",
        text: "Order not found.",
      };
      return res.redirect("/supermarket/orders");
    }

    const delivery = await Delivery.findOne({
      orderId: order._id,
    }).populate("courierUserId", "name email phone address");

    res.render("supermarket/order-detail", {
      title: "Order Detail",
      supermarket: req.supermarket,
      order,
      delivery,
    });
  } catch (err) {
    next(err);
  }
};

ordersSupermarketcontroller.updateOrderStatus = async function (
  req,
  res,
  next,
) {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      supermarketId: req.supermarket._id,
    });

    if (!order) {
      req.session.flash = {
        type: "danger",
        text: "Order not found.",
      };
      return res.redirect("/supermarket/orders");
    }

    const currentStatus = order.status;
    const nextStatus = (req.body.status || "").trim();

    const allowedNextStatuses = [];

    if (currentStatus === "pending") {
      allowedNextStatuses.push("confirmed", "cancelled");
    }

    if (currentStatus === "confirmed") {
      allowedNextStatuses.push("preparing", "cancelled");
    }

    if (currentStatus === "preparing") {
      if (order.deliveryMethod === "pickup") {
        allowedNextStatuses.push("delivered");
      }

      if (order.deliveryMethod === "courier") {
        allowedNextStatuses.push("delivering");
      }
    }

    if (!allowedNextStatuses.includes(nextStatus)) {
      req.session.flash = {
        type: "warning",
        text: "Invalid status transition for this order.",
      };
      return res.redirect(`/supermarket/orders/${order._id}`);
    }

    if (nextStatus === "cancelled") {
      if (order.deliveryMethod === "courier") {
        const assignedDelivery = await Delivery.findOne({
          orderId: order._id,
          status: { $in: ["accepted", "picked_up", "delivered"] },
        });

        if (assignedDelivery) {
          req.session.flash = {
            type: "warning",
            text: "This order can no longer be cancelled because the delivery is already in progress.",
          };
          return res.redirect(`/supermarket/orders/${order._id}`);
        }
      }

      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: Number(item.quantity) },
        });
      }

      if (order.couponCode) {
        await Coupon.findOneAndUpdate(
          {
            supermarketId: order.supermarketId,
            code: String(order.couponCode).trim().toUpperCase(),
            usedCount: { $gt: 0 },
          },
          {
            $inc: { usedCount: -1 },
          },
        );
      }

      if (order.deliveryMethod === "courier") {
        await Delivery.findOneAndDelete({
          orderId: order._id,
          courierUserId: null,
          status: { $in: ["pending", "available"] },
        });
      }

      order.cancelledAt = new Date();
    }

    if (nextStatus === "confirmed" && !order.confirmedAt) {
      order.confirmedAt = new Date();
    }

    order.status = nextStatus;
    await order.save();

    if (
      currentStatus === "confirmed" &&
      nextStatus === "preparing" &&
      order.deliveryMethod === "courier"
    ) {
      await Delivery.findOneAndUpdate(
        { orderId: order._id, status: "pending" },
        { $set: { status: "available" } },
      );
    }

    await sendOrderStatusEmail(order._id);

    req.session.flash = {
      type: "success",
      text: `Order updated to ${nextStatus}.`,
    };

    return res.redirect(`/supermarket/orders/${order._id}`);
  } catch (err) {
    next(err);
  }
};

module.exports = ordersSupermarketcontroller;
