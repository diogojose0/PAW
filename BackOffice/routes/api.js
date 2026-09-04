const express = require("express");

const authApiController = require("../controllers/api/authApiController");
const categoryApiController = require("../controllers/api/categoryApiController");
const dashboardApiController = require("../controllers/api/dashboardApiController");
const orderApiController = require("../controllers/api/orderApiController");
const paymentApiController = require("../controllers/api/paymentApiController");
const productApiController = require("../controllers/api/productApiController");
const reviewApiController = require("../controllers/api/reviewApiController");
const supermarketApiController = require("../controllers/api/supermarketApiController");

const {
  requireApiAuth,
  requireApiClient,
} = require("../middlewares/apiAuth.middleware");

const router = express.Router();

/**
 * GET /api/health
 *
 * Simple endpoint to confirm that the REST API is running.
 */
router.get("/health", function (req, res) {
  return res.json({
    status: "ok",
    message: "REST API is running.",
  });
});

/**
 * POST /api/auth/register
 *
 * Registers a new client account.
 */
router.post("/auth/register", authApiController.register);

/**
 * POST /api/auth/login
 *
 * Authenticates a client account.
 */
router.post("/auth/login", authApiController.login);

/**
 * GET /api/auth/me
 *
 * Returns the authenticated client profile.
 */
router.get(
  "/auth/me",
  requireApiAuth,
  requireApiClient,
  authApiController.me,
);

/**
 * PUT /api/auth/me
 *
 * Updates the authenticated client profile.
 */
router.put(
  "/auth/me",
  requireApiAuth,
  requireApiClient,
  authApiController.updateMe,
);

/**
 * PUT /api/auth/password
 *
 * Updates the authenticated client's password.
 */
router.put(
  "/auth/password",
  requireApiAuth,
  requireApiClient,
  authApiController.updatePassword,
);

/**
 * GET /api/dashboard/client
 *
 * Returns dashboard statistics for the authenticated client.
 */
router.get(
  "/dashboard/client",
  requireApiAuth,
  requireApiClient,
  dashboardApiController.getClientDashboard,
);

/**
 * GET /api/categories
 *
 * Lists active categories for the frontoffice.
 */
router.get("/categories", categoryApiController.listCategories);

/**
 * POST /api/orders/validate-coupon
 *
 * Validates a coupon before creating an order.
 */
router.post(
  "/orders/validate-coupon",
  requireApiAuth,
  requireApiClient,
  orderApiController.validateCoupon,
);

/**
 * POST /api/orders
 *
 * Creates a new order for the authenticated client.
 */
router.post(
  "/orders",
  requireApiAuth,
  requireApiClient,
  orderApiController.createOrder,
);

/**
 * GET /api/orders
 *
 * Lists orders created by the authenticated client.
 */
router.get(
  "/orders",
  requireApiAuth,
  requireApiClient,
  orderApiController.listClientOrders,
);

/**
 * POST /api/orders/:id/cancel
 *
 * Cancels one order created by the authenticated client.
 */
router.post(
  "/orders/:id/cancel",
  requireApiAuth,
  requireApiClient,
  orderApiController.cancelClientOrder,
);

/**
 * GET /api/orders/:id
 *
 * Returns one order created by the authenticated client.
 */
router.get(
  "/orders/:id",
  requireApiAuth,
  requireApiClient,
  orderApiController.getClientOrderById,
);

/**
 * GET /api/products/compare
 *
 * Compares prices for the same product across approved supermarkets.
 */
router.get("/products/compare", productApiController.compareProductPrices);

/**
 * GET /api/products
 *
 * Lists available products from approved supermarkets.
 */
router.get("/products", productApiController.listProducts);

/**
 * GET /api/supermarkets
 *
 * Lists approved supermarkets for the frontoffice.
 */
router.get("/supermarkets", supermarketApiController.listSupermarkets);

/**
 * GET /api/supermarkets/:id/products
 *
 * Lists available products from one approved supermarket.
 */
router.get(
  "/supermarkets/:id/products",
  supermarketApiController.listSupermarketProducts,
);

/**
 * GET /api/supermarkets/:id
 *
 * Returns the details of one approved supermarket.
 */
router.get("/supermarkets/:id", supermarketApiController.getSupermarketById);

/**
 * GET /api/supermarkets/:id/reviews
 *
 * Lists public reviews for one supermarket.
 */
router.get(
  "/supermarkets/:id/reviews",
  reviewApiController.listSupermarketReviews,
);

/**
 * GET /api/orders/:orderId/review
 *
 * Returns the authenticated client's review for a delivered order.
 */
router.get(
  "/orders/:orderId/review",
  requireApiAuth,
  requireApiClient,
  reviewApiController.getOrderReview,
);

/**
 * PUT /api/orders/:orderId/review
 *
 * Creates or updates the authenticated client's review for a delivered order.
 */
router.put(
  "/orders/:orderId/review",
  requireApiAuth,
  requireApiClient,
  reviewApiController.saveOrderReview,
);

/**
 * POST /api/payments/stripe/create-checkout-session
 *
 * Creates a Stripe Checkout Session for one authenticated client's order.
 */
router.post(
  "/payments/stripe/create-checkout-session",
  requireApiAuth,
  requireApiClient,
  paymentApiController.createStripeCheckoutSession,
);

/**
 * POST /api/payments/stripe/confirm-session
 *
 * Confirms a Stripe Checkout Session after the client returns to the site.
 */
router.post(
  "/payments/stripe/confirm-session",
  requireApiAuth,
  requireApiClient,
  paymentApiController.confirmStripeCheckoutSession,
);

module.exports = router;