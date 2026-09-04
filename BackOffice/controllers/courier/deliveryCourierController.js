const Delivery = require("../../models/Delivery");
const Order = require("../../models/Order");
const { sendOrderStatusEmail } = require("../../services/emailService");

function getAvailableDeliveriesQuery() {
  return Delivery.find({
    status: "available",
    courierUserId: null,
  })
    .populate({
      path: "orderId",
      populate: {
        path: "supermarketId",
        select: "name location",
      },
    })
    .sort({ createdAt: -1 });
}

function getCourierDeliveriesQuery(courierUserId) {
  return Delivery.find({
    courierUserId,
  })
    .populate({
      path: "orderId",
      populate: {
        path: "supermarketId",
        select: "name location",
      },
    })
    .sort({ createdAt: -1 });
}

function getDeliveryDetailQuery(deliveryId) {
  return Delivery.findById(deliveryId)
    .populate({
      path: "orderId",
      populate: [
        {
          path: "supermarketId",
          select: "name location openingHours deliveryMethods deliveryCosts",
        },
        {
          path: "clientUserId",
          select: "name email phone address",
        },
      ],
    })
    .populate("courierUserId", "name email phone");
}

const deliveryCourierController = {};

deliveryCourierController.availableDeliveries = async function (req, res, next) {
  try {
    const deliveries = await getAvailableDeliveriesQuery();

    res.render("courier/available-deliveries", {
      title: "Available Deliveries",
      deliveries,
    });
  } catch (err) {
    next(err);
  }
};

deliveryCourierController.deliveryDetail = async function (req, res, next) {
  try {
    const delivery = await getDeliveryDetailQuery(req.params.id);

    if (!delivery || !delivery.orderId) {
      req.session.flash = {
        type: "danger",
        text: "Delivery not found.",
      };
      return res.redirect("/courier/deliveries/available");
    }

    const isAvailableDelivery =
      delivery.status === "available" && !delivery.courierUserId;

    const isAssignedToCurrentCourier =
      delivery.courierUserId &&
      String(delivery.courierUserId._id) === String(req.user._id);

    if (!isAvailableDelivery && !isAssignedToCurrentCourier) {
      req.session.flash = {
        type: "danger",
        text: "You do not have permission to view this delivery.",
      };
      return res.redirect("/courier/deliveries/my");
    }

    res.render("courier/delivery-detail", {
      title: "Delivery Detail",
      delivery,
      order: delivery.orderId,
    });
  } catch (err) {
    next(err);
  }
};

deliveryCourierController.acceptDelivery = async function (req, res, next) {
  try {
    const activeDelivery = await Delivery.findOne({
      courierUserId: req.user._id,
      status: { $in: ["accepted", "picked_up"] },
    });

    if (activeDelivery) {
      req.session.flash = {
        type: "warning",
        text: "You already have an active delivery assigned.",
      };
      return res.redirect("/courier/deliveries/available");
    }

    const delivery = await Delivery.findOne({
      _id: req.params.id,
      status: "available",
      courierUserId: null,
    });

    if (!delivery) {
      req.session.flash = {
        type: "danger",
        text: "Delivery is no longer available.",
      };
      return res.redirect("/courier/deliveries/available");
    }

    const order = await Order.findById(delivery.orderId);

    if (!order) {
      req.session.flash = {
        type: "danger",
        text: "The order associated with this delivery no longer exists.",
      };
      return res.redirect("/courier/deliveries/available");
    }

    if (order.status === "cancelled" || order.status === "delivered") {
      req.session.flash = {
        type: "warning",
        text: "This delivery can no longer be accepted.",
      };
      return res.redirect("/courier/deliveries/available");
    }

    if (order.deliveryMethod !== "courier") {
      req.session.flash = {
        type: "warning",
        text: "This order does not require courier delivery.",
      };
      return res.redirect("/courier/deliveries/available");
    }

    delivery.courierUserId = req.user._id;
    delivery.status = "accepted";
    delivery.acceptedAt = new Date();
    await delivery.save();

    let shouldNotifyClient = false;

    if (order.status === "preparing" || order.status === "confirmed") {
      order.status = "delivering";
      await order.save();
      shouldNotifyClient = true;
    }

    if (shouldNotifyClient) {
      await sendOrderStatusEmail(order._id);
    }

    req.session.flash = {
      type: "success",
      text: "Delivery accepted successfully.",
    };

    return res.redirect("/courier/deliveries/my");
  } catch (err) {
    next(err);
  }
};

deliveryCourierController.myDeliveries = async function (req, res, next) {
  try {
    const deliveries = await getCourierDeliveriesQuery(req.user._id);

    res.render("courier/my-deliveries", {
      title: "My Deliveries",
      deliveries,
    });
  } catch (err) {
    next(err);
  }
};

deliveryCourierController.updateDeliveryStatus = async function (req, res, next) {
  try {
    const delivery = await Delivery.findOne({
      _id: req.params.id,
      courierUserId: req.user._id,
    });

    if (!delivery) {
      req.session.flash = {
        type: "danger",
        text: "Delivery not found.",
      };
      return res.redirect("/courier/deliveries/my");
    }

    const order = await Order.findById(delivery.orderId);

    if (!order) {
      req.session.flash = {
        type: "danger",
        text: "The order associated with this delivery no longer exists.",
      };
      return res.redirect("/courier/deliveries/my");
    }

    if (order.status === "cancelled") {
      req.session.flash = {
        type: "warning",
        text: "This order was cancelled and the delivery can no longer be updated.",
      };
      return res.redirect("/courier/deliveries/my");
    }

    if (delivery.status === "accepted") {
      delivery.status = "picked_up";
      await delivery.save();

      if (order.status !== "delivering") {
        order.status = "delivering";
        await order.save();
        await sendOrderStatusEmail(order._id);
      }

      req.session.flash = {
        type: "success",
        text: "Delivery updated to picked up.",
      };
      return res.redirect("/courier/deliveries/my");
    }

    if (delivery.status === "picked_up") {
      delivery.status = "delivered";
      delivery.deliveredAt = new Date();
      await delivery.save();

      order.status = "delivered";
      await order.save();

      await sendOrderStatusEmail(order._id);

      req.session.flash = {
        type: "success",
        text: "Delivery updated to delivered.",
      };
      return res.redirect("/courier/deliveries/my");
    }

    req.session.flash = {
      type: "warning",
      text: "This delivery can no longer be updated.",
    };

    return res.redirect("/courier/deliveries/my");
  } catch (err) {
    next(err);
  }
};

module.exports = deliveryCourierController;