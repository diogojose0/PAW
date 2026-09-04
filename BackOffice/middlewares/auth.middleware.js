const jwt = require("jsonwebtoken");
const config = require("../config/jwtConfig");
const User = require("../models/User");
const Supermarket = require("../models/Supermarket");

async function attachUserIfExists(req, res, next) {
  try {
    const authToken = req.cookies["auth-token"];

    if (!authToken) {
      req.user = null;
      res.locals.currentUser = null;
      return next();
    }

    const decoded = jwt.verify(authToken, config.secret);

    const user = await User.findById(decoded.id).select("-passwordHash");

    if (!user || !user.active) {
      res.clearCookie("auth-token");
      req.user = null;
      res.locals.currentUser = null;
      return next();
    }

    req.user = user;
    res.locals.currentUser = user;
    next();
  } catch (err) {
    res.clearCookie("auth-token");
    req.user = null;
    res.locals.currentUser = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    req.session.flash = {
      type: "warning",
      text: "You need to log in to access this page!",
    };
    return res.redirect("/auth/login");
  }

  next();
}

function allowRoles(roles) {
  return (req, res, next) => {
    if (!req.user) {
      req.session.flash = {
        type: "warning",
        text: "You need to log in to access this page!",
      };
      return res.redirect("/auth/login");
    }

    if (!roles.includes(req.user.role)) {
      req.session.flash = {
        type: "danger",
        text: "No permission to access this page!",
      };
      return res.redirect("/");
    }

    next();
  };
}

async function loadSupermarket(req, res, next) {
  try {
    if (!req.user || req.user.role !== "supermarket") {
      req.session.flash = {
        type: "danger",
        text: "Restricted access to supermarkets.",
      };
      return res.redirect("/");
    }

    const supermarket = await Supermarket.findOne({
      ownerUserId: req.user._id,
    });

    if (!supermarket) {
      req.session.flash = {
        type: "danger",
        text: "Supermarket not found.",
      };
      return res.redirect("/");
    }

    req.supermarket = supermarket;
    next();
  } catch (err) {
    next(err);
  }
}

function requireApprovedSupermarket(req, res, next) {
  if (!req.supermarket) {
    req.session.flash = {
      type: "danger",
      text: "Supermarket not found!",
    };
    return res.redirect("/");
  }

  if (req.supermarket.approvalStatus === "rejected") {
    req.session.flash = {
      type: "danger",
      text: `Your supermarket was rejected. Reason: ${req.supermarket.rejectionReason || "No reason provided."}`,
    };
    return res.redirect("/supermarket/");
  }

  if (!req.supermarket.approvedByAdmin) {
    req.session.flash = {
      type: "warning",
      text: "Your supermarket is pending admin approval. You can configure it, but you cannot register sales yet.",
    };
    return res.redirect("/supermarket/");
  }

  next();
}

function redirectIfAuthenticated(req, res, next) {
  if (req.user) {
    return res.redirect("/");
  }

  next();
}

module.exports = {
  attachUserIfExists,
  requireAuth,
  allowRoles,
  loadSupermarket,
  requireApprovedSupermarket,
  redirectIfAuthenticated,
};
