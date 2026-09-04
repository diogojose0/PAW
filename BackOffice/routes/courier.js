const express = require("express");
const router = express.Router();

const courierController = require("../controllers/courier/courierController");
const deliveryCourierController = require("../controllers/courier/deliveryCourierController");

const { requireAuth, allowRoles } = require("../middlewares/auth.middleware");

router.use(requireAuth, allowRoles(["courier"]));

// general
router.get("/", courierController.dashboard);

// deliveries
router.get("/deliveries/available", deliveryCourierController.availableDeliveries);
router.get("/deliveries/available/:id", deliveryCourierController.deliveryDetail);
router.post("/deliveries/:id/accept", deliveryCourierController.acceptDelivery);

router.get("/deliveries/my", deliveryCourierController.myDeliveries);
router.get("/deliveries/my/:id", deliveryCourierController.deliveryDetail);
router.post(
  "/deliveries/:id/update-status",
  deliveryCourierController.updateDeliveryStatus,
);

module.exports = router;