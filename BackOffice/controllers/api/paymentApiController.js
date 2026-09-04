const mongoose = require("mongoose");

const Order = require("../../models/Order");
const {
  createCheckoutSessionForOrder,
  retrieveCheckoutSession,
} = require("../../services/stripeCheckoutService");

const paymentApiController = {};

paymentApiController.createStripeCheckoutSession = async function (
  req,
  res,
  next,
) {
  try {
    const orderId = req.body.orderId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      clientUserId: req.user._id,
    })
      .populate("clientUserId", "name email")
      .lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    if (order.paymentMethod !== "stripe") {
      return res.status(400).json({
        message: "This order was not created with Stripe payment.",
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        message: "This order is already paid.",
      });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({
        message: "Cancelled orders cannot be paid.",
      });
    }

    const session = await createCheckoutSessionForOrder(
      order,
      order.clientUserId,
    );

    await Order.findByIdAndUpdate(order._id, {
      stripeCheckoutSessionId: session.id,
      paymentStatus: "unpaid",
    });

    return res.json({
      message: "Stripe Checkout Session created successfully.",
      checkoutUrl: session.url,
      sessionId: session.id,
      orderId: order._id,
    });
  } catch (error) {
    next(error);
  }
};

paymentApiController.confirmStripeCheckoutSession = async function (
  req,
  res,
  next,
) {
  try {
    const sessionId = String(req.body.sessionId || "").trim();

    if (!sessionId) {
      return res.status(400).json({
        message: "Stripe session ID is required.",
      });
    }

    const session = await retrieveCheckoutSession(sessionId);

    const order = await Order.findOne({
      stripeCheckoutSessionId: session.id,
      clientUserId: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found for this Stripe session.",
      });
    }

    if (session.payment_status === "paid") {
      order.paymentStatus = "paid";
      order.stripePaymentIntentId = session.payment_intent || null;
      order.paidAt = new Date();
      await order.save();
    }

    if (session.payment_status !== "paid") {
      order.paymentStatus = "unpaid";
      await order.save();
    }

    const updatedOrder = await Order.findById(order._id)
      .populate("supermarketId", "name location deliveryMethods deliveryCosts")
      .populate("clientUserId", "name email phone address")
      .lean();

    return res.json({
      message:
        session.payment_status === "paid"
          ? "Payment confirmed successfully."
          : "Payment has not been completed yet.",
      paymentStatus: order.paymentStatus,
      stripePaymentStatus: session.payment_status,
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = paymentApiController;