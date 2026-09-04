const Product = require("../../models/Product");
const Order = require("../../models/Order");
const Delivery = require("../../models/Delivery");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../../models/User");
const Coupon = require("../../models/Coupon");

const { getCategories } = require("../../services/categoryService");
const { sendOrderStatusEmail } = require("../../services/emailService");

function getSaleSession(req) {
  if (!req.session.sale) {
    req.session.sale = {
      customerId: null,
      pendingCustomerEmail: null,
      items: [],
      coupon: null,
    };
  }

  if (!Object.prototype.hasOwnProperty.call(req.session.sale, "coupon")) {
    req.session.sale.coupon = null;
  }

  return req.session.sale;
}

function normalizeSaleItems(sale) {
  if (!Array.isArray(sale.items)) {
    sale.items = [];
  }

  sale.items = sale.items.map((item) => {
    const priceSnapshot = Number(item.priceSnapshot || 0);
    const quantity = Number(item.quantity || 0);

    return {
      ...item,
      priceSnapshot,
      quantity,
      subtotal: priceSnapshot * quantity,
    };
  });

  sale.itemsTotal = sale.items.reduce((sum, item) => sum + item.subtotal, 0);

  return sale;
}

async function getSaleProducts(
  supermarketId,
  productSearch = "",
  categoryId = "",
) {
  const filter = {
    supermarketId,
    active: true,
    stock: { $gt: 0 },
  };

  if (productSearch) {
    filter.name = { $regex: productSearch, $options: "i" };
  }

  if (categoryId) {
    filter.categoryId = categoryId;
  }

  return Product.find(filter).populate("categoryId").sort({ name: 1 });
}

function getDeliveryCostForMethod(supermarket, deliveryMethod) {
  if (deliveryMethod === "pickup") {
    return Number(supermarket.deliveryCosts?.pickup || 0);
  }

  if (deliveryMethod === "courier") {
    return Number(supermarket.deliveryCosts?.courier || 0);
  }

  return 0;
}

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function getCouponValidationError(coupon, itemsTotal) {
  if (!coupon) {
    return "Coupon not found.";
  }

  const now = new Date();

  if (!coupon.active) {
    return "This coupon is inactive.";
  }

  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    return "This coupon is not valid yet.";
  }

  if (coupon.validUntil && new Date(coupon.validUntil) < now) {
    return "This coupon has expired.";
  }

  if (
    coupon.usageLimit !== null &&
    coupon.usageLimit !== undefined &&
    Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)
  ) {
    return "This coupon has reached its usage limit.";
  }

  if (Number(itemsTotal || 0) < Number(coupon.minOrderValue || 0)) {
    return `This coupon requires a minimum order of ${Number(
      coupon.minOrderValue || 0,
    ).toFixed(2)} €.`;
  }

  return null;
}

function calculateCouponDiscount(
  coupon,
  itemsTotal,
  deliveryMethod = null,
  deliveryCost = 0,
) {
  const normalizedItemsTotal = roundCurrency(itemsTotal);

  if (!coupon) {
    return 0;
  }

  let discount = 0;

  if (coupon.discountType === "free_shipping") {
    if (deliveryMethod === "courier") {
      discount = Number(deliveryCost || 0);
    }
  } else {
    if (normalizedItemsTotal <= 0) {
      return 0;
    }

    if (coupon.discountType === "percent") {
      discount =
        normalizedItemsTotal * (Number(coupon.discountValue || 0) / 100);
    } else if (coupon.discountType === "fixed") {
      discount = Number(coupon.discountValue || 0);
    }

    if (discount > normalizedItemsTotal) {
      discount = normalizedItemsTotal;
    }
  }

  discount = roundCurrency(discount);

  if (discount < 0) {
    discount = 0;
  }

  return discount;
}

function hydrateSaleSummary(sale) {
  normalizeSaleItems(sale);

  sale.discountAmount = 0;
  sale.discountedItemsTotal = roundCurrency(sale.itemsTotal);

  if (!sale.coupon) {
    return sale;
  }

  sale.coupon.discountType = sale.coupon.discountType || null;
  sale.coupon.discountValue = Number(sale.coupon.discountValue || 0);
  sale.coupon.minOrderValue = Number(sale.coupon.minOrderValue || 0);

  const couponLike = {
    active:
      sale.coupon.active === undefined ? true : Boolean(sale.coupon.active),
    validFrom: sale.coupon.validFrom || null,
    validUntil: sale.coupon.validUntil || null,
    usageLimit:
      sale.coupon.usageLimit === undefined ? null : sale.coupon.usageLimit,
    usedCount: Number(sale.coupon.usedCount || 0),
    discountType: sale.coupon.discountType,
    discountValue: Number(sale.coupon.discountValue || 0),
    minOrderValue: Number(sale.coupon.minOrderValue || 0),
  };

  const validationError = getCouponValidationError(couponLike, sale.itemsTotal);

  if (validationError) {
    sale.coupon.discountAmount = 0;
    sale.coupon.isApplicable = false;
    sale.coupon.validationError = validationError;
    sale.discountAmount = 0;
    sale.discountedItemsTotal = roundCurrency(sale.itemsTotal);
    return sale;
  }

  if (couponLike.discountType === "free_shipping") {
    sale.coupon.discountAmount = 0;
    sale.coupon.isApplicable = true;
    sale.coupon.validationError = null;
    sale.discountAmount = 0;
    sale.discountedItemsTotal = roundCurrency(sale.itemsTotal);
    return sale;
  }

  const discountAmount = calculateCouponDiscount(couponLike, sale.itemsTotal);

  sale.coupon.discountAmount = discountAmount;
  sale.coupon.isApplicable = discountAmount > 0;
  sale.coupon.validationError = null;

  sale.discountAmount = discountAmount;
  sale.discountedItemsTotal = roundCurrency(
    Math.max(sale.itemsTotal - discountAmount, 0),
  );

  return sale;
}

function buildSalePageUrl(productSearch = "", category = "") {
  const params = new URLSearchParams();

  if (productSearch) {
    params.set("productSearch", productSearch);
  }

  if (category) {
    params.set("category", category);
  }

  const queryString = params.toString();
  return queryString
    ? `/supermarket/sales/new?${queryString}`
    : "/supermarket/sales/new";
}

function buildProductsPageUrl(search = "", category = "") {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }

  if (category) {
    params.set("category", category);
  }

  const queryString = params.toString();
  return queryString
    ? `/supermarket/products?${queryString}`
    : "/supermarket/products";
}

async function renderSalePage(req, res, options = {}) {
  const sale = getSaleSession(req);
  hydrateSaleSummary(sale);

  const productSearch = (options.productSearch || "").trim();
  const category = (options.category || "").trim();

  let customer = null;

  if (sale.customerId) {
    customer = await User.findById(sale.customerId).select("-passwordHash");
  }

  const [products, categories] = await Promise.all([
    getSaleProducts(req.supermarket._id, productSearch, category),
    getCategories(),
  ]);

  return res.status(options.statusCode || 200).render("supermarket/sale-form", {
    title: "New Sale",
    customer,
    products,
    categories,
    productSearch,
    selectedCategory: category,
    sale,
    supermarket: req.supermarket,
    error: options.error || null,
    successMessage: options.successMessage || null,
  });
}

const saleSupermarketcontroller = {};

saleSupermarketcontroller.salesForm = async function (req, res, next) {
  try {
    return renderSalePage(req, res, {
      productSearch: req.query.productSearch || "",
      category: req.query.category || "",
    });
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.checkSaleCustomerEmail = async function (
  req,
  res,
  next,
) {
  try {
    const sale = getSaleSession(req);
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return renderSalePage(req, res, {
        statusCode: 400,
        error: "Insert a valid email!",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role !== "client") {
        return renderSalePage(req, res, {
          statusCode: 400,
          error: "This email already belongs to another type of user!",
        });
      }

      sale.customerId = existingUser._id;
      sale.pendingCustomerEmail = null;

      return res.redirect("/supermarket/sales/new");
    }

    sale.customerId = null;
    sale.pendingCustomerEmail = email;

    return res.redirect("/supermarket/sales/new");
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.createSaleCustomer = async function (req, res, next) {
  try {
    const sale = getSaleSession(req);

    const email = sale.pendingCustomerEmail?.trim().toLowerCase();
    const name = req.body.name?.trim();
    const address = req.body.address?.trim();
    const phone = req.body.phone?.trim();

    if (!email) {
      return res.redirect("/supermarket/sales/new");
    }

    if (!name || !address || !phone) {
      return renderSalePage(req, res, {
        statusCode: 400,
        error: "Fill in the new customer's details.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role !== "client") {
        return renderSalePage(req, res, {
          statusCode: 400,
          error: "This email already belongs to another type of user!",
        });
      }

      sale.customerId = existingUser._id;
      sale.pendingCustomerEmail = null;

      return res.redirect("/supermarket/sales/new");
    }

    const tempPassword = crypto.randomBytes(8).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const customer = await User.create({
      name,
      email,
      passwordHash,
      address,
      phone,
      role: "client",
      active: true,
    });

    sale.customerId = customer._id;
    sale.pendingCustomerEmail = null;

    return res.redirect("/supermarket/sales/new");
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.clearSaleCustomer = async function (req, res, next) {
  try {
    const sale = getSaleSession(req);
    sale.customerId = null;
    sale.pendingCustomerEmail = null;
    res.redirect("/supermarket/sales/new");
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.addToSaleCart = async function (req, res, next) {
  try {
    const sale = getSaleSession(req);
    const productId = req.body.productId;
    const productSearch = (req.body.productSearch || "").trim();
    const category = (req.body.category || "").trim();

    let quantity = parseInt(req.body.quantity || "1", 10);

    if (!productId) {
      return renderSalePage(req, res, {
        statusCode: 400,
        productSearch,
        category,
        error: "Invalid product.",
      });
    }

    if (Number.isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    const product = await Product.findOne({
      _id: productId,
      supermarketId: req.supermarket._id,
      active: true,
    });

    if (!product) {
      return renderSalePage(req, res, {
        statusCode: 404,
        productSearch,
        category,
        error: "Product not found.",
      });
    }

    const existingItem = sale.items.find(
      (item) => item.productId === product._id.toString(),
    );

    const currentQuantity = existingItem ? Number(existingItem.quantity) : 0;
    const nextQuantity = currentQuantity + quantity;

    if (nextQuantity > product.stock) {
      return renderSalePage(req, res, {
        statusCode: 400,
        productSearch,
        category,
        error: "Insufficient stock for that quantity.",
      });
    }

    if (existingItem) {
      existingItem.quantity = nextQuantity;
      existingItem.subtotal =
        Number(existingItem.priceSnapshot) * Number(existingItem.quantity);
    } else {
      sale.items.push({
        productId: product._id.toString(),
        nameSnapshot: product.name,
        priceSnapshot: Number(product.price),
        quantity,
        subtotal: Number(product.price) * quantity,
      });
    }

    normalizeSaleItems(sale);

    res.redirect(buildSalePageUrl(productSearch, category));
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.updateSaleCartItem = async function (req, res, next) {
  try {
    const sale = getSaleSession(req);
    const productId = req.body.productId;
    const quantity = parseInt(req.body.quantity || "0", 10);
    const productSearch = (req.body.productSearch || "").trim();
    const category = (req.body.category || "").trim();

    const existingItem = sale.items.find(
      (item) => item.productId === productId,
    );

    if (!existingItem) {
      return renderSalePage(req, res, {
        statusCode: 404,
        productSearch,
        category,
        error: "Product not found in the cart.",
      });
    }

    if (Number.isNaN(quantity) || quantity < 1) {
      return renderSalePage(req, res, {
        statusCode: 400,
        productSearch,
        category,
        error: "Quantity must be at least 1.",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      supermarketId: req.supermarket._id,
      active: true,
    });

    if (!product) {
      return renderSalePage(req, res, {
        statusCode: 404,
        productSearch,
        category,
        error: "Product no longer available.",
      });
    }

    if (quantity > product.stock) {
      return renderSalePage(req, res, {
        statusCode: 400,
        productSearch,
        category,
        error: `Insufficient stock for ${product.name}.`,
      });
    }

    existingItem.quantity = quantity;
    existingItem.priceSnapshot = Number(product.price);
    existingItem.subtotal = Number(product.price) * quantity;

    normalizeSaleItems(sale);

    return res.redirect(buildSalePageUrl(productSearch, category));
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.removeFromSaleCart = async function (req, res, next) {
  try {
    const sale = getSaleSession(req);
    const productId = req.body.productId;
    const productSearch = (req.body.productSearch || "").trim();
    const category = (req.body.category || "").trim();

    sale.items = sale.items.filter((item) => item.productId !== productId);
    normalizeSaleItems(sale);

    res.redirect(buildSalePageUrl(productSearch, category));
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.clearSaleCart = async function (req, res, next) {
  try {
    const sale = getSaleSession(req);
    const productSearch = (req.body.productSearch || "").trim();
    const category = (req.body.category || "").trim();

    sale.items = [];
    normalizeSaleItems(sale);

    res.redirect(buildSalePageUrl(productSearch, category));
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.applySaleCoupon = async function (req, res, next) {
  try {
    const sale = getSaleSession(req);
    hydrateSaleSummary(sale);

    const code = (req.body.code || "").trim().toUpperCase();
    const productSearch = (req.body.productSearch || "").trim();
    const category = (req.body.category || "").trim();

    if (!sale.items || sale.items.length === 0) {
      return renderSalePage(req, res, {
        statusCode: 400,
        error: "Add products to the sale before applying a coupon.",
        productSearch,
        category,
      });
    }

    if (!code) {
      return renderSalePage(req, res, {
        statusCode: 400,
        error: "Insert a coupon code.",
        productSearch,
        category,
      });
    }

    const coupon = await Coupon.findOne({
      supermarketId: req.supermarket._id,
      code,
    });

    const validationError = getCouponValidationError(coupon, sale.itemsTotal);

    if (validationError) {
      return renderSalePage(req, res, {
        statusCode: 400,
        error: validationError,
        productSearch,
        category,
      });
    }

    sale.coupon = {
      couponId: coupon._id.toString(),
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue || 0),
      minOrderValue: Number(coupon.minOrderValue || 0),
      active: Boolean(coupon.active),
      validFrom: coupon.validFrom || null,
      validUntil: coupon.validUntil || null,
      usageLimit:
        coupon.usageLimit === null || coupon.usageLimit === undefined
          ? null
          : Number(coupon.usageLimit),
      usedCount: Number(coupon.usedCount || 0),
    };

    hydrateSaleSummary(sale);

    req.session.flash = {
      type: "success",
      text: `Coupon ${coupon.code} applied successfully.`,
    };

    return res.redirect(buildSalePageUrl(productSearch, category));
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.clearSaleCoupon = async function (req, res, next) {
  try {
    const sale = getSaleSession(req);
    const productSearch = (req.body.productSearch || "").trim();
    const category = (req.body.category || "").trim();

    sale.coupon = null;
    hydrateSaleSummary(sale);

    req.session.flash = {
      type: "info",
      text: "Coupon removed from the current sale.",
    };

    return res.redirect(buildSalePageUrl(productSearch, category));
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.checkoutSale = async function (req, res, next) {
  try {
    const sale = getSaleSession(req);
    hydrateSaleSummary(sale);

    const deliveryMethod = req.body.deliveryMethod;

    if (!sale.customerId) {
      return renderSalePage(req, res, {
        statusCode: 400,
        error: "Associate a customer before checkout.",
      });
    }

    if (!sale.items || sale.items.length === 0) {
      return renderSalePage(req, res, {
        statusCode: 400,
        error: "Add at least one product before checkout.",
      });
    }

    const availableMethods = Array.isArray(req.supermarket.deliveryMethods)
      ? req.supermarket.deliveryMethods
      : [];

    if (!availableMethods.includes(deliveryMethod)) {
      return renderSalePage(req, res, {
        statusCode: 400,
        error: "Choose a valid delivery method.",
      });
    }

    const productIds = sale.items.map((item) => item.productId);

    const products = await Product.find({
      _id: { $in: productIds },
      supermarketId: req.supermarket._id,
      active: true,
    });

    if (products.length !== sale.items.length) {
      return renderSalePage(req, res, {
        statusCode: 400,
        error: "Some products are no longer available.",
      });
    }

    const productMap = new Map(
      products.map((product) => [product._id.toString(), product]),
    );

    const orderItems = [];
    let itemsTotal = 0;

    for (const saleItem of sale.items) {
      const product = productMap.get(saleItem.productId);

      if (!product) {
        return renderSalePage(req, res, {
          statusCode: 400,
          error: "Some products are invalid.",
        });
      }

      if (product.stock < saleItem.quantity) {
        return renderSalePage(req, res, {
          statusCode: 400,
          error: `Insufficient stock for ${product.name}.`,
        });
      }

      const priceSnapshot = Number(product.price);
      const quantity = Number(saleItem.quantity);
      const subtotal = priceSnapshot * quantity;

      orderItems.push({
        productId: product._id,
        nameSnapshot: product.name,
        priceSnapshot,
        quantity,
        subtotal,
      });

      itemsTotal += subtotal;
    }

    itemsTotal = roundCurrency(itemsTotal);

    let couponDocument = null;
    let discountAmount = 0;
    let couponCode = null;
    let discountType = null;
    let discountValue = 0;

    const deliveryCost = getDeliveryCostForMethod(
      req.supermarket,
      deliveryMethod,
    );

    if (sale.coupon && sale.coupon.couponId) {
      couponDocument = await Coupon.findOne({
        _id: sale.coupon.couponId,
        supermarketId: req.supermarket._id,
      });

      const couponValidationError = getCouponValidationError(
        couponDocument,
        itemsTotal,
      );

      if (couponValidationError) {
        sale.coupon = null;
        hydrateSaleSummary(sale);

        return renderSalePage(req, res, {
          statusCode: 400,
          error: `The selected coupon is no longer valid: ${couponValidationError}`,
        });
      }

      if (
        couponDocument.discountType === "free_shipping" &&
        deliveryMethod !== "courier"
      ) {
        return renderSalePage(req, res, {
          statusCode: 400,
          error:
            "Free shipping coupons can only be used with courier delivery.",
        });
      }

      discountAmount = calculateCouponDiscount(
        couponDocument,
        itemsTotal,
        deliveryMethod,
        deliveryCost,
      );
      couponCode = couponDocument.code;
      discountType = couponDocument.discountType;
      discountValue = Number(couponDocument.discountValue || 0);
    }

    const finalTotal = roundCurrency(
      Math.max(itemsTotal + deliveryCost - discountAmount, 0),
    );

    const order = await Order.create({
      clientUserId: sale.customerId,
      supermarketId: req.supermarket._id,
      items: orderItems,
      itemsTotal,
      couponCode,
      discountType,
      discountValue,
      discountAmount,
      deliveryMethod,
      deliveryCost,
      finalTotal,
      status: "pending",
      createdAt: new Date(),
    });

    if (couponDocument) {
      couponDocument.usedCount = Number(couponDocument.usedCount || 0) + 1;
      await couponDocument.save();
    }

    if (deliveryMethod === "courier") {
      await Delivery.create({
        orderId: order._id,
        status: "pending",
      });
    }

    for (const saleItem of sale.items) {
      const product = productMap.get(saleItem.productId);
      product.stock -= Number(saleItem.quantity);
      await product.save();
    }

    await sendOrderStatusEmail(order._id);

    req.session.sale = {
      customerId: null,
      pendingCustomerEmail: null,
      items: [],
      coupon: null,
    };

    req.session.flash = {
      type: "success",
      text: `Sale completed successfully. Order ${order._id} was created.`,
    };

    res.redirect("/supermarket/sales/new");
  } catch (err) {
    next(err);
  }
};

saleSupermarketcontroller.addProductToSaleFromProducts = async function (
  req,
  res,
  next,
) {
  try {
    const sale = getSaleSession(req);
    const productId = req.params.id;
    const search = (req.body.search || "").trim();
    const category = (req.body.category || "").trim();
    let quantity = parseInt(req.body.quantity || "1", 10);

    if (!req.supermarket.approvedByAdmin) {
      req.session.flash = {
        type: "warning",
        text: "Your supermarket must be approved before creating sales.",
      };
      return res.redirect(buildProductsPageUrl(search, category));
    }

    if (Number.isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    const product = await Product.findOne({
      _id: productId,
      supermarketId: req.supermarket._id,
      active: true,
    });

    if (!product) {
      req.session.flash = {
        type: "danger",
        text: "Product not found or unavailable.",
      };
      return res.redirect(buildProductsPageUrl(search, category));
    }

    const existingItem = sale.items.find(
      (item) => item.productId === product._id.toString(),
    );

    const currentQuantity = existingItem ? Number(existingItem.quantity) : 0;
    const nextQuantity = currentQuantity + quantity;

    if (nextQuantity > product.stock) {
      req.session.flash = {
        type: "danger",
        text: "Insufficient stock for that quantity.",
      };
      return res.redirect(buildProductsPageUrl(search, category));
    }

    if (existingItem) {
      existingItem.quantity = nextQuantity;
      existingItem.subtotal =
        Number(existingItem.priceSnapshot) * Number(existingItem.quantity);
    } else {
      sale.items.push({
        productId: product._id.toString(),
        nameSnapshot: product.name,
        priceSnapshot: Number(product.price),
        quantity,
        subtotal: Number(product.price) * quantity,
      });
    }

    normalizeSaleItems(sale);

    req.session.flash = {
      type: "success",
      text: `${product.name} added to the current sale cart.`,
    };

    return res.redirect(buildProductsPageUrl(search, category));
  } catch (err) {
    next(err);
  }
};

module.exports = saleSupermarketcontroller;
