const Coupon = require("../../models/Coupon");

function renderCouponFormView(res, options = {}) {
  return res
    .status(options.statusCode || 200)
    .render("supermarket/coupon-form", {
      title: options.title || "New Coupon",
      coupon: options.coupon || {
        code: "",
        name: "",
        discountType: "fixed",
        discountValue: 0,
        minOrderValue: 0,
        validFrom: "",
        validUntil: "",
        usageLimit: "",
        active: true,
      },
      error: options.error || null,
    });
}

const couponSupermarketcontroller = {};

couponSupermarketcontroller.couponsList = async function (req, res, next) {
  try {
    const coupons = await Coupon.find({
      supermarketId: req.supermarket._id,
    }).sort({ createdAt: -1, code: 1 });

    return res.render("supermarket/coupons", {
      title: "Coupons",
      coupons,
    });
  } catch (err) {
    next(err);
  }
};

couponSupermarketcontroller.newCouponForm = async function (req, res, next) {
  try {
    return renderCouponFormView(res, {
      title: "New Coupon",
    });
  } catch (err) {
    next(err);
  }
};

couponSupermarketcontroller.createCoupon = async function (req, res, next) {
  try {
    const {
      code,
      name,
      discountType,
      discountValue,
      minOrderValue,
      validFrom,
      validUntil,
      usageLimit,
    } = req.body;

    const couponData = {
      code: (code || "").trim().toUpperCase(),
      name: (name || "").trim(),
      discountType: (discountType || "").trim(),
      discountValue: Number(discountValue || 0),
      minOrderValue: Number(minOrderValue || 0),
      validFrom: validFrom || "",
      validUntil: validUntil || "",
      usageLimit: usageLimit || "",
      active: true,
    };

    if (!couponData.code || !couponData.name || !couponData.discountType) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "Fill in all required fields.",
        coupon: couponData,
      });
    }

    if (!["fixed", "percent", "free_shipping"].includes(couponData.discountType)) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "Invalid discount type.",
        coupon: couponData,
      });
    }

    if (couponData.discountType === "free_shipping") {
      couponData.discountValue = 0;
    } else if (couponData.discountValue <= 0) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "Discount value must be greater than zero.",
        coupon: couponData,
      });
    }

    if (
      couponData.discountType === "percent" &&
      couponData.discountValue > 100
    ) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "Percentage discount cannot be greater than 100.",
        coupon: couponData,
      });
    }

    if (couponData.minOrderValue < 0) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "Minimum order value cannot be negative.",
        coupon: couponData,
      });
    }

    if (couponData.usageLimit !== "" && Number(couponData.usageLimit) <= 0) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "Usage limit must be greater than zero.",
        coupon: couponData,
      });
    }

    const parsedValidFrom = couponData.validFrom
      ? new Date(couponData.validFrom)
      : null;
    const parsedValidUntil = couponData.validUntil
      ? new Date(couponData.validUntil)
      : null;

    if (couponData.validFrom && Number.isNaN(parsedValidFrom?.getTime?.())) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "Invalid start date.",
        coupon: couponData,
      });
    }

    if (couponData.validUntil && Number.isNaN(parsedValidUntil?.getTime?.())) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "Invalid end date.",
        coupon: couponData,
      });
    }

    if (
      parsedValidFrom &&
      parsedValidUntil &&
      parsedValidUntil < parsedValidFrom
    ) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "End date must be after start date.",
        coupon: couponData,
      });
    }

    await Coupon.create({
      supermarketId: req.supermarket._id,
      code: couponData.code,
      name: couponData.name,
      discountType: couponData.discountType,
      discountValue: couponData.discountValue,
      minOrderValue: couponData.minOrderValue,
      validFrom: parsedValidFrom,
      validUntil: parsedValidUntil,
      usageLimit:
        couponData.usageLimit === "" ? null : Number(couponData.usageLimit),
      active: true,
    });

    req.session.flash = {
      type: "success",
      text: `Coupon ${couponData.code} created successfully.`,
    };

    return res.redirect("/supermarket/coupons");
  } catch (err) {
    if (err && err.code === 11000) {
      return renderCouponFormView(res, {
        statusCode: 400,
        error: "A coupon with that code already exists for this supermarket.",
        coupon: {
          code: (req.body.code || "").trim().toUpperCase(),
          name: (req.body.name || "").trim(),
          discountType: (req.body.discountType || "").trim(),
          discountValue: Number(req.body.discountValue || 0),
          minOrderValue: Number(req.body.minOrderValue || 0),
          validFrom: req.body.validFrom || "",
          validUntil: req.body.validUntil || "",
          usageLimit: req.body.usageLimit || "",
          active: true,
        },
      });
    }

    next(err);
  }
};

couponSupermarketcontroller.toggleCouponActive = async function (req, res, next) {
  try {
    const coupon = await Coupon.findOne({
      _id: req.params.id,
      supermarketId: req.supermarket._id,
    });

    if (!coupon) {
      req.session.flash = {
        type: "danger",
        text: "Coupon not found.",
      };
      return res.redirect("/supermarket/coupons");
    }

    coupon.active = !coupon.active;
    await coupon.save();

    req.session.flash = {
      type: "success",
      text: `Coupon ${coupon.code} is now ${coupon.active ? "active" : "inactive"}.`,
    };

    return res.redirect("/supermarket/coupons");
  } catch (err) {
    next(err);
  }
};

module.exports = couponSupermarketcontroller;