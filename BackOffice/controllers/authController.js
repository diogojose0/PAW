const User = require("../models/User");
const Supermarket = require("../models/Supermarket");
const jwt = require("jsonwebtoken");
const config = require("../config/jwtConfig");
const bcrypt = require("bcryptjs");

let authController = {};

function renderLogin(res, options = {}) {
  return res.render("auth/login", {
    error: options.error || null,
    formData: options.formData || {},
  });
}

function renderRegister(res, options = {}) {
  return res.render("auth/register", {
    error: options.error || null,
    formData: options.formData || {},
  });
}

authController.submittedLogin = async function (req, res, next) {
  try {
    const emailInput = req.body.email;
    const passwordInput = req.body.password;

    if (!emailInput || !passwordInput) {
      res.status(400);
      return renderLogin(res, {
        error: "You need to fill in your email and password.",
        formData: {
          email: req.body.email || "",
        },
      });
    }

    const user = await User.findOne({ email: emailInput });

    if (!user || !user.active || user.role === "client") {
      res.status(400);
      return renderLogin(res, {
        error: "Invalid or inactive user.",
        formData: {
          email: req.body.email || "",
        },
      });
    }

    const passwordOk = await bcrypt.compare(passwordInput, user.passwordHash);

    if (!passwordOk) {
      res.status(401);
      return renderLogin(res, {
        error: "Incorrect password.",
        formData: {
          email: req.body.email || "",
        },
      });
    }

    const authToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      config.secret,
      { expiresIn: "1d" },
    );

    res.cookie("auth-token", authToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    if (user.role === "admin") {
      return res.redirect("/admin");
    }

    return res.redirect("/");
  } catch (err) {
    next(err);
  }
};

authController.login = function (req, res) {
  renderLogin(res);
};

authController.logout = function (req, res) {
  res.clearCookie("auth-token");

  req.session.flash = {
    type: "success",
    text: "Session ended successfully.",
  };

  res.redirect("/");
};

authController.createLogin = function (req, res) {
  renderRegister(res);
};

authController.createLoginSubmitted = async function (req, res, next) {
  try {
    const {
      name,
      email,
      password,
      address,
      phone,
      role,
      supermarketName,
      supermarketDescription,
      supermarketLocation,
      supermarketOpeningHours,
      deliveryMethods,
      deliveryCosts,
    } = req.body;

    const safeFormData = {
      name: name || "",
      email: email || "",
      address: address || "",
      phone: phone || "",
      role: role || "courier",
      supermarketName: supermarketName || "",
      supermarketDescription: supermarketDescription || "",
      supermarketLocation: supermarketLocation || "",
      supermarketOpeningHours: supermarketOpeningHours || "",
      deliveryMethods: Array.isArray(deliveryMethods)
        ? deliveryMethods
        : deliveryMethods
          ? [deliveryMethods]
          : [],
      deliveryCosts: {
        pickup: deliveryCosts?.pickup || 0,
        courier: deliveryCosts?.courier || 0,
      },
    };

    if (!name || !email || !password || !address || !phone || !role) {
      res.status(400);
      return renderRegister(res, {
        error: "You must fill in all the fields.",
        formData: safeFormData,
      });
    }

    if (
      Number(deliveryCosts?.pickup || 0) < 0 ||
      Number(deliveryCosts?.courier || 0) < 0
    ) {
      res.status(400);
      return renderRegister(res, {
        error: "The delivery costs cant be negative!",
        formData: safeFormData,
      });
    }

    if (!["supermarket", "courier"].includes(role)) {
      res.status(400);
      return renderRegister(res, {
        error: "Invalid type account!",
        formData: safeFormData,
      });
    }

    const existingUser = await User.findOne({
      email: email.trim(),
    });

    if (existingUser) {
      res.status(400);
      return renderRegister(res, {
        error: "The user already exists.",
        formData: safeFormData,
      });
    }

    if (role === "supermarket") {
      if (
        !supermarketName ||
        !supermarketOpeningHours ||
        !supermarketLocation
      ) {
        res.status(400);
        return renderRegister(res, {
          error: "You must fill in all supermaket required fields.",
          formData: safeFormData,
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: name.trim(),
      email: email.trim(),
      passwordHash: hashedPassword,
      address: address.trim(),
      phone: phone.trim(),
      role,
      active: true,
    });

    if (role === "supermarket") {
      const normalizedDeliveryMethods = Array.isArray(deliveryMethods)
        ? deliveryMethods
        : deliveryMethods
          ? [deliveryMethods]
          : [];

      await Supermarket.create({
        ownerUserId: newUser._id,
        name: supermarketName.trim(),
        description: supermarketDescription?.trim() || "",
        location: supermarketLocation.trim(),
        openingHours: supermarketOpeningHours.trim(),
        deliveryMethods: normalizedDeliveryMethods,
        deliveryCosts: {
          pickup: Number(deliveryCosts?.pickup || 0),
          courier: Number(deliveryCosts?.courier || 0),
        },
        approvedByAdmin: false,
      });
    }

    const authToken = jwt.sign(
      {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
      },
      config.secret,
      { expiresIn: "1d" },
    );

    res.cookie("auth-token", authToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect("/");
  } catch (err) {
    next(err);
  }
};

module.exports = authController;