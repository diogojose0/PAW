const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../../models/User");
const config = require("../../config/jwtConfig");

const authApiController = {};

function buildPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    address: user.address,
    phone: user.phone,
    role: user.role,
    active: user.active,
  };
}

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    config.secret,
    {
      expiresIn: "1d",
    },
  );
}

authApiController.register = async function (req, res, next) {
  try {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    const address = (req.body.address || "").trim();
    const phone = (req.body.phone || "").trim();

    if (!name || !email || !password || !address || !phone) {
      return res.status(400).json({
        message: "Name, email, password, address and phone are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must have at least 6 characters.",
      });
    }

    const existingUser = await User.findOne({
      email,
    }).lean();

    if (existingUser) {
      return res.status(409).json({
        message: "A user with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash,
      address,
      phone,
      role: "client",
      active: true,
    });

    const token = createToken(user);

    return res.status(201).json({
      message: "Client registered successfully.",
      token,
      user: buildPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

authApiController.login = async function (req, res, next) {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email,
    });

    if (!user || !user.active || user.role !== "client") {
      return res.status(401).json({
        message: "Invalid client credentials.",
      });
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      return res.status(401).json({
        message: "Invalid client credentials.",
      });
    }

    const token = createToken(user);

    return res.json({
      message: "Client authenticated successfully.",
      token,
      user: buildPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

authApiController.me = async function (req, res) {
  return res.json({
    user: buildPublicUser(req.user),
  });
};

authApiController.updateMe = async function (req, res, next) {
  try {
    const updates = {};

    if (typeof req.body.name === "string") {
      const name = req.body.name.trim();

      if (!name) {
        return res.status(400).json({
          message: "Name cannot be empty.",
        });
      }

      updates.name = name;
    }

    if (typeof req.body.email === "string") {
      const email = req.body.email.trim().toLowerCase();

      if (!email) {
        return res.status(400).json({
          message: "Email cannot be empty.",
        });
      }

      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user._id },
      }).lean();

      if (existingUser) {
        return res.status(409).json({
          message: "A user with this email already exists.",
        });
      }

      updates.email = email;
    }

    if (typeof req.body.address === "string") {
      const address = req.body.address.trim();

      if (!address) {
        return res.status(400).json({
          message: "Address cannot be empty.",
        });
      }

      updates.address = address;
    }

    if (typeof req.body.phone === "string") {
      const phone = req.body.phone.trim();

      if (!phone) {
        return res.status(400).json({
          message: "Phone cannot be empty.",
        });
      }

      updates.phone = phone;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid profile fields were provided.",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    return res.json({
      message: "Profile updated successfully.",
      user: buildPublicUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

authApiController.updatePassword = async function (req, res, next) {
  try {
    const currentPassword = req.body.currentPassword || "";
    const newPassword = req.body.newPassword || "";

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must have at least 6 characters.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from the current password.",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user || !user.active || user.role !== "client") {
      return res.status(401).json({
        message: "Invalid client account.",
      });
    }

    const currentPasswordIsValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordIsValid) {
      return res.status(401).json({
        message: "Current password is incorrect.",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);

    await user.save();

    return res.json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = authApiController;
