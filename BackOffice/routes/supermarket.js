const express = require("express");
const router = express.Router();

const supermarketController = require("../controllers/supermarket/supermarketController");
const productsController = require("../controllers/supermarket/productsSupermarketcontroller");
const ordersController = require("../controllers/supermarket/ordersSupermarketcontroller");
const saleController = require("../controllers/supermarket/saleSupermarketcontroller");
const couponController = require("../controllers/supermarket/couponSupermarketcontroller");

const {
  requireAuth,
  allowRoles,
  loadSupermarket,
  requireApprovedSupermarket,
} = require("../middlewares/auth.middleware");
const createUploader = require("../middlewares/upload.middleware");

const productUpload = createUploader({
  folder: "uploads/products",
  allowedExtensions: ["jpg", "jpeg", "png", "webp"],
  maxSize: 2 * 1024 * 1024,
});

router.use(requireAuth, allowRoles(["supermarket"]), loadSupermarket);

// general
router.get("/", supermarketController.dashboard);
router.get("/settings", supermarketController.settingsForm);
router.post("/updateSettings", supermarketController.updateSettings);

// products
router.get("/products", productsController.productsList);
router.get("/products/new", productsController.newProductForm);
router.post(
  "/products/new",
  productUpload.single("image"),
  productsController.createProduct,
);

router.get("/products/:id/edit", productsController.editProductForm);
router.post(
  "/products/:id/edit",
  productUpload.single("image"),
  productsController.updateProduct,
);

router.post(
  "/products/:id/toggle-active",
  productsController.toggleProductActive,
);

router.post(
  "/products/:id/add-to-sale",
  requireApprovedSupermarket,
  saleController.addProductToSaleFromProducts,
);

// orders
router.get("/orders", ordersController.ordersList);
router.get("/orders/:id", ordersController.orderDetail);
router.post("/orders/:id/status", ordersController.updateOrderStatus);

// sale
router.get("/sales/new", requireApprovedSupermarket, saleController.salesForm);

router.post(
  "/sales/customer/check-email",
  requireApprovedSupermarket,
  saleController.checkSaleCustomerEmail,
);

router.post(
  "/sales/customer/create",
  requireApprovedSupermarket,
  saleController.createSaleCustomer,
);

router.post(
  "/sales/customer/clear",
  requireApprovedSupermarket,
  saleController.clearSaleCustomer,
);

router.post(
  "/sales/cart/add",
  requireApprovedSupermarket,
  saleController.addToSaleCart,
);

router.post(
  "/sales/cart/update",
  requireApprovedSupermarket,
  saleController.updateSaleCartItem,
);

router.post(
  "/sales/cart/remove",
  requireApprovedSupermarket,
  saleController.removeFromSaleCart,
);

router.post(
  "/sales/cart/clear",
  requireApprovedSupermarket,
  saleController.clearSaleCart,
);

router.post(
  "/sales/checkout",
  requireApprovedSupermarket,
  saleController.checkoutSale,
);

// coupon
router.post(
  "/sales/coupon/apply",
  requireApprovedSupermarket,
  saleController.applySaleCoupon,
);

router.post(
  "/sales/coupon/clear",
  requireApprovedSupermarket,
  saleController.clearSaleCoupon,
);

router.get("/coupons", couponController.couponsList);
router.get("/coupons/new", couponController.newCouponForm);
router.post("/coupons/new", couponController.createCoupon);
router.post("/coupons/:id/toggle-active", couponController.toggleCouponActive);

module.exports = router;