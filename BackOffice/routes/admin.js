const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin/adminController");
const usersController = require("../controllers/admin/userAdminController");
const ordersController = require("../controllers/admin/orderAdminController");
const categoriesController = require("../controllers/admin/categoryAdminController");

const { requireAuth, allowRoles } = require("../middlewares/auth.middleware");

router.use(requireAuth, allowRoles(["admin"]));

// general
router.get("/", adminController.dashboard);

// users / supermarkets pending
router.get("/supermarkets/pending", usersController.pendingSupermarkets);
router.post("/supermarkets/:id/approve", usersController.approveSupermarket);
router.post("/supermarkets/:id/reject", usersController.rejectSupermarket);

router.get("/users", usersController.usersList);
router.post("/users/:id/toggle-active", usersController.toggleUserActive);

// orders
router.get("/orders", ordersController.ordersList);
router.get("/orders/:id", ordersController.orderDetail);

// categories
router.get("/categories", categoriesController.categoriesList);
router.get("/categories/new", categoriesController.newCategoryForm);
router.post("/categories/new", categoriesController.createCategory);
router.get("/categories/:id/edit", categoriesController.editCategoryForm);
router.post("/categories/:id/edit", categoriesController.updateCategory);
router.post(
  "/categories/:id/toggle-active",
  categoriesController.toggleCategoryActive,
);

module.exports = router;