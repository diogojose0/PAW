const mongoose = require("mongoose");

const Coupon = require("../../models/Coupon");
const Delivery = require("../../models/Delivery");
const Order = require("../../models/Order");
const Product = require("../../models/Product");
const Supermarket = require("../../models/Supermarket");

const orderApiController = {};

const CLIENT_CANCEL_WINDOW_MS = 5 * 60 * 1000;

function isWithinClientCancelWindow(order, now) {
  const confirmationDate =
    order.confirmedAt || order.updatedAt || order.createdAt;

  if (!confirmationDate) {
    return false;
  }

  const confirmationTime = new Date(confirmationDate).getTime();

  return now.getTime() - confirmationTime <= CLIENT_CANCEL_WINDOW_MS;
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function validateAndCalculateCoupon({
  couponCode,
  supermarketId,
  itemsTotal,
  deliveryCost,
  deliveryMethod,
}) {
  const normalizedCouponCode = String(couponCode || "")
    .trim()
    .toUpperCase();

  if (!normalizedCouponCode) {
    return {
      couponCode: null,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
    };
  }

  const coupon = await Coupon.findOne({
    supermarketId,
    code: normalizedCouponCode,
    active: true,
  }).lean();

  if (!coupon) {
    return {
      error: "Invalid coupon code.",
    };
  }

  const now = new Date();

  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    return {
      error: "This coupon is not valid yet.",
    };
  }

  if (coupon.validUntil) {
    const validUntil = new Date(coupon.validUntil);
    validUntil.setHours(23, 59, 59, 999);

    if (validUntil < now) {
      return {
        error: "This coupon has expired.",
      };
    }
  }

  if (
    coupon.usageLimit !== null &&
    coupon.usageLimit !== undefined &&
    Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)
  ) {
    return {
      error: "This coupon has reached its usage limit.",
    };
  }

  if (roundCurrency(itemsTotal) < roundCurrency(coupon.minOrderValue || 0)) {
    return {
      error: `This coupon requires a minimum order value of ${roundCurrency(coupon.minOrderValue)} €.`,
    };
  }

  let discountAmount = 0;

  if (coupon.discountType === "fixed") {
    discountAmount = Math.min(
      roundCurrency(coupon.discountValue),
      roundCurrency(itemsTotal),
    );
  }

  if (coupon.discountType === "percent") {
    discountAmount = roundCurrency(
      roundCurrency(itemsTotal) * (Number(coupon.discountValue) / 100),
    );
  }

  if (coupon.discountType === "free_shipping") {
    if (deliveryMethod !== "courier") {
      return {
        error: "Free shipping coupons can only be used with courier delivery.",
      };
    }

    discountAmount = roundCurrency(deliveryCost);
  }

  return {
    couponId: coupon._id,
    couponCode: coupon.code,
    discountType: coupon.discountType,
    discountValue: roundCurrency(coupon.discountValue),
    discountAmount: roundCurrency(discountAmount),
  };
}

function normalizeCartItems(items) {
  const normalizedItemsMap = new Map();

  for (const item of items) {
    const productId = String(item.productId || "").trim();
    const quantity = Number(item.quantity || 0);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return {
        error: "Invalid product ID.",
      };
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return {
        error: "Product quantity must be a positive integer.",
      };
    }

    const previousQuantity = normalizedItemsMap.get(productId) || 0;
    normalizedItemsMap.set(productId, previousQuantity + quantity);
  }

  return {
    items: Array.from(normalizedItemsMap.entries()).map(
      ([productId, quantity]) => ({
        productId,
        quantity,
      }),
    ),
  };
}

orderApiController.createOrder = async function (req, res, next) {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const deliveryMethod = String(req.body.deliveryMethod || "").trim();
    const paymentMethod = String(
      req.body.paymentMethod || "on_delivery",
    ).trim();
    const couponCode = String(req.body.couponCode || "")
      .trim()
      .toUpperCase();

    if (items.length === 0) {
      return res.status(400).json({
        message: "Order must contain at least one product.",
      });
    }

    if (!["pickup", "courier"].includes(deliveryMethod)) {
      return res.status(400).json({
        message: "Invalid delivery method.",
      });
    }

    if (!["on_delivery", "stripe"].includes(paymentMethod)) {
      return res.status(400).json({
        message: "Invalid payment method.",
      });
    }

    const normalizedCart = normalizeCartItems(items);

    if (normalizedCart.error) {
      return res.status(400).json({
        message: normalizedCart.error,
      });
    }

    const productIds = normalizedCart.items.map((item) => item.productId);

    const products = await Product.find({
      _id: { $in: productIds },
    }).lean();

    if (products.length !== productIds.length) {
      return res.status(400).json({
        message: "One or more products were not found.",
      });
    }

    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );

    const supermarketIds = new Set(
      products.map((product) => String(product.supermarketId)),
    );

    if (supermarketIds.size !== 1) {
      return res.status(400).json({
        message: "An order can only contain products from one supermarket.",
      });
    }

    const supermarketId = Array.from(supermarketIds)[0];

    const supermarket = await Supermarket.findOne({
      _id: supermarketId,
      approvedByAdmin: true,
    }).lean();

    if (!supermarket) {
      return res.status(400).json({
        message: "The supermarket is not available for orders.",
      });
    }

    if (!supermarket.deliveryMethods.includes(deliveryMethod)) {
      return res.status(400).json({
        message:
          "Selected delivery method is not available for this supermarket.",
      });
    }

    const orderItems = [];
    let itemsTotal = 0;

    for (const cartItem of normalizedCart.items) {
      const product = productMap.get(cartItem.productId);

      if (!product.active) {
        return res.status(400).json({
          message: `Product "${product.name}" is not active.`,
        });
      }

      if (Number(product.stock || 0) < cartItem.quantity) {
        return res.status(400).json({
          message: `Product "${product.name}" does not have enough stock.`,
        });
      }

      const priceSnapshot = roundCurrency(product.price);
      const subtotal = roundCurrency(priceSnapshot * cartItem.quantity);

      orderItems.push({
        productId: product._id,
        nameSnapshot: product.name,
        priceSnapshot,
        quantity: cartItem.quantity,
        subtotal,
      });

      itemsTotal += subtotal;
    }

    itemsTotal = roundCurrency(itemsTotal);

    const deliveryCost = roundCurrency(
      supermarket.deliveryCosts?.[deliveryMethod] || 0,
    );

    const couponResult = await validateAndCalculateCoupon({
      couponCode,
      supermarketId,
      itemsTotal,
      deliveryCost,
      deliveryMethod,
    });

    if (couponResult.error) {
      return res.status(400).json({
        message: couponResult.error,
      });
    }

    const finalTotal = roundCurrency(
      Math.max(itemsTotal + deliveryCost - couponResult.discountAmount, 0),
    );

    const order = await Order.create({
      clientUserId: req.user._id,
      supermarketId,
      items: orderItems,
      itemsTotal,
      couponCode: couponResult.couponCode,
      discountType: couponResult.discountType,
      discountValue: couponResult.discountValue,
      discountAmount: couponResult.discountAmount,
      deliveryMethod,
      deliveryCost,
      finalTotal,
      paymentMethod,
      paymentStatus: paymentMethod === "stripe" ? "unpaid" : "pending",
      status: "pending",
      createdAt: new Date(),
    });

    if (couponResult.couponId) {
      await Coupon.findByIdAndUpdate(couponResult.couponId, {
        $inc: {
          usedCount: 1,
        },
      });
    }

    if (deliveryMethod === "courier") {
      await Delivery.create({
        orderId: order._id,
        status: "pending",
      });
    }

    for (const cartItem of normalizedCart.items) {
      await Product.findByIdAndUpdate(cartItem.productId, {
        $inc: {
          stock: -cartItem.quantity,
        },
      });
    }

    const createdOrder = await Order.findById(order._id)
      .populate("supermarketId", "name location deliveryMethods deliveryCosts")
      .populate("clientUserId", "name email phone address")
      .lean();

    return res.status(201).json({
      message: "Order created successfully.",
      order: createdOrder,
    });
  } catch (error) {
    next(error);
  }
};

orderApiController.validateCoupon = async function (req, res, next) {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const deliveryMethod = String(req.body.deliveryMethod || "").trim();
    const couponCode = String(req.body.couponCode || "")
      .trim()
      .toUpperCase();

    if (!couponCode) {
      return res.status(400).json({
        message: "Coupon code is required.",
      });
    }

    if (items.length === 0) {
      return res.status(400).json({
        message: "Cart must contain at least one product.",
      });
    }

    if (!["pickup", "courier"].includes(deliveryMethod)) {
      return res.status(400).json({
        message: "Invalid delivery method.",
      });
    }

    const normalizedCart = normalizeCartItems(items);

    if (normalizedCart.error) {
      return res.status(400).json({
        message: normalizedCart.error,
      });
    }

    const productIds = normalizedCart.items.map((item) => item.productId);

    const products = await Product.find({
      _id: { $in: productIds },
    }).lean();

    if (products.length !== productIds.length) {
      return res.status(400).json({
        message: "One or more products were not found.",
      });
    }

    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );

    const supermarketIds = new Set(
      products.map((product) => String(product.supermarketId)),
    );

    if (supermarketIds.size !== 1) {
      return res.status(400).json({
        message: "An order can only contain products from one supermarket.",
      });
    }

    const supermarketId = Array.from(supermarketIds)[0];

    const supermarket = await Supermarket.findOne({
      _id: supermarketId,
      approvedByAdmin: true,
    }).lean();

    if (!supermarket) {
      return res.status(400).json({
        message: "The supermarket is not available for orders.",
      });
    }

    if (!supermarket.deliveryMethods.includes(deliveryMethod)) {
      return res.status(400).json({
        message:
          "Selected delivery method is not available for this supermarket.",
      });
    }

    let itemsTotal = 0;

    for (const cartItem of normalizedCart.items) {
      const product = productMap.get(cartItem.productId);

      if (!product.active) {
        return res.status(400).json({
          message: `Product "${product.name}" is not active.`,
        });
      }

      if (Number(product.stock || 0) < cartItem.quantity) {
        return res.status(400).json({
          message: `Product "${product.name}" does not have enough stock.`,
        });
      }

      const priceSnapshot = roundCurrency(product.price);
      const subtotal = roundCurrency(priceSnapshot * cartItem.quantity);

      itemsTotal += subtotal;
    }

    itemsTotal = roundCurrency(itemsTotal);

    const deliveryCost = roundCurrency(
      supermarket.deliveryCosts?.[deliveryMethod] || 0,
    );

    const couponResult = await validateAndCalculateCoupon({
      couponCode,
      supermarketId,
      itemsTotal,
      deliveryCost,
      deliveryMethod,
    });

    if (couponResult.error) {
      return res.status(400).json({
        message: couponResult.error,
      });
    }

    const finalTotal = roundCurrency(
      Math.max(itemsTotal + deliveryCost - couponResult.discountAmount, 0),
    );

    return res.json({
      message: "Coupon applied successfully.",
      couponCode: couponResult.couponCode,
      discountType: couponResult.discountType,
      discountValue: couponResult.discountValue,
      discountAmount: couponResult.discountAmount,
      itemsTotal,
      deliveryCost,
      finalTotal,
    });
  } catch (error) {
    next(error);
  }
};

orderApiController.listClientOrders = async function (req, res, next) {
  try {
    const orders = await Order.find({
      clientUserId: req.user._id,
    })
      .populate("supermarketId", "name location deliveryMethods deliveryCosts")
      .select(
        "supermarketId items itemsTotal deliveryMethod deliveryCost finalTotal paymentMethod paymentStatus paidAt status createdAt cancelledAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    const orderIds = orders.map((order) => order._id);

    const deliveries = await Delivery.find({
      orderId: { $in: orderIds },
    })
      .select("orderId courierUserId status acceptedAt deliveredAt")
      .populate("courierUserId", "name phone")
      .lean();

    const deliveryMap = new Map(
      deliveries.map((delivery) => [String(delivery.orderId), delivery]),
    );

    const ordersWithDelivery = orders.map((order) => ({
      ...order,
      delivery: deliveryMap.get(String(order._id)) || null,
    }));

    return res.json({
      count: ordersWithDelivery.length,
      orders: ordersWithDelivery,
    });
  } catch (error) {
    next(error);
  }
};

orderApiController.getClientOrderById = async function (req, res, next) {
  try {
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      clientUserId: req.user._id,
    })
      .populate("supermarketId", "name location deliveryMethods deliveryCosts")
      .populate("clientUserId", "name email phone address")
      .populate("items.productId", "name description imageUrl categoryId")
      .select(
        "clientUserId supermarketId items itemsTotal couponCode discountType discountValue discountAmount deliveryMethod deliveryCost finalTotal paymentMethod paymentStatus stripeCheckoutSessionId paidAt status createdAt cancelledAt",
      )
      .lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    const delivery = await Delivery.findOne({
      orderId: order._id,
    })
      .select("orderId courierUserId status acceptedAt deliveredAt")
      .populate("courierUserId", "name phone")
      .lean();

    return res.json({
      order: {
        ...order,
        delivery: delivery || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

orderApiController.cancelClientOrder = async function (req, res, next) {
  try {
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      clientUserId: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({
        message: "Order is already cancelled.",
      });
    }

    if (order.status === "delivered") {
      return res.status(400).json({
        message: "Delivered orders cannot be cancelled.",
      });
    }

    if (["preparing", "delivering"].includes(order.status)) {
      return res.status(400).json({
        message: "This order can no longer be cancelled by the client.",
      });
    }

    if (order.status === "confirmed") {
      const now = new Date();

      if (!isWithinClientCancelWindow(order, now)) {
        return res.status(400).json({
          message: "The 5 minute cancellation window has expired.",
        });
      }
    }

    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        message: "This order cannot be cancelled.",
      });
    }

    if (order.deliveryMethod === "courier") {
      const assignedDelivery = await Delivery.findOne({
        orderId: order._id,
        status: { $in: ["accepted", "picked_up", "delivered"] },
      });

      if (assignedDelivery) {
        return res.status(400).json({
          message:
            "This order can no longer be cancelled because the delivery is already in progress.",
        });
      }
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: {
          stock: Number(item.quantity),
        },
      });
    }

    if (order.deliveryMethod === "courier") {
      await Delivery.findOneAndDelete({
        orderId: order._id,
        courierUserId: null,
        status: { $in: ["pending", "available"] },
      });
    }

    order.status = "cancelled";
    order.cancelledAt = new Date();

    await order.save();

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

    const cancelledOrder = await Order.findById(order._id)
      .populate("supermarketId", "name location deliveryMethods deliveryCosts")
      .populate("clientUserId", "name email phone address")
      .lean();

    return res.json({
      message: "Order cancelled successfully.",
      order: cancelledOrder,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = orderApiController;
