const User = require("../../models/User");
const Supermarket = require("../../models/Supermarket");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const Delivery = require("../../models/Delivery");

const userAdminController = {};

userAdminController.pendingSupermarkets = async function (req, res, next) {
  try {
    const supermarkets = await Supermarket.find({ approvalStatus: "pending" })
      .populate("ownerUserId", "name email active")
      .sort({ createdAt: -1 });

    res.render("admin/supermarkets", {
      title: "Pending Supermarkets",
      supermarkets,
    });
  } catch (err) {
    next(err);
  }
};

userAdminController.approveSupermarket = async function (req, res, next) {
  try {
    const supermarket = await Supermarket.findById(req.params.id);

    if (!supermarket) {
      req.session.flash = {
        type: "danger",
        text: "Supermarket not found.",
      };
      return res.redirect("/admin/supermarkets/pending");
    }

    supermarket.approvalStatus = "approved";
    supermarket.approvedByAdmin = true;
    supermarket.rejectionReason = "";
    supermarket.rejectedAt = null;
    supermarket.approvedAt = new Date();
    supermarket.reviewedByAdminUserId = req.user._id;

    await supermarket.save();

    req.session.flash = {
      type: "success",
      text: "Supermarket approved successfully.",
    };

    res.redirect("/admin/supermarkets/pending");
  } catch (err) {
    next(err);
  }
};

userAdminController.rejectSupermarket = async function (req, res, next) {
  try {
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      req.session.flash = {
        type: "danger",
        text: "You must provide a reason for rejecting the supermarket.",
      };
      return res.redirect("/admin/supermarkets/pending");
    }

    const supermarket = await Supermarket.findOne({
      _id: req.params.id,
      approvalStatus: "pending",
    });

    if (!supermarket) {
      req.session.flash = {
        type: "danger",
        text: "Pending supermarket not found.",
      };
      return res.redirect("/admin/supermarkets/pending");
    }

    supermarket.approvalStatus = "rejected";
    supermarket.approvedByAdmin = false;
    supermarket.rejectionReason = rejectionReason.trim();
    supermarket.rejectedAt = new Date();
    supermarket.approvedAt = null;
    supermarket.reviewedByAdminUserId = req.user._id;

    await supermarket.save();

    req.session.flash = {
      type: "warning",
      text: "Supermarket rejected successfully.",
    };

    res.redirect("/admin/supermarkets/pending");
  } catch (err) {
    next(err);
  }
};

userAdminController.usersList = async function (req, res, next) {
  try {
    const users = await User.find({ role: { $ne: "admin" } })
      .select("-passwordHash")
      .sort({ role: 1, name: 1 });

    res.render("admin/users", {
      title: "Users",
      users,
    });
  } catch (err) {
    next(err);
  }
};

userAdminController.toggleUserActive = async function (req, res, next) {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.session.flash = {
        type: "danger",
        text: "User not found!",
      };
      return res.redirect("/admin/users");
    }

    user.active = !user.active;
    await user.save();

    req.session.flash = {
      type: "success",
      text: `User ${user.active ? "enabled" : "disabled"} successfully.`,
    };

    res.redirect("/admin/users");
  } catch (err) {
    next(err);
  }
};

module.exports = userAdminController;
