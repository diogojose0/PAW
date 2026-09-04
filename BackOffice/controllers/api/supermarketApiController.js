const mongoose = require("mongoose");
const Supermarket = require("../../models/Supermarket");
const Product = require("../../models/Product");

const supermarketApiController = {};

supermarketApiController.listSupermarkets = async function (req, res, next) {
  try {
    const search = (req.query.search || "").trim();

    const filter = {
      approvedByAdmin: true,
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const supermarkets = await Supermarket.find(filter)
      .select(
        "name description location openingHours deliveryMethods deliveryCosts coordinates approvedByAdmin",
      )
      .sort({ name: 1 })
      .lean();

    return res.json({
      count: supermarkets.length,
      supermarkets,
    });
  } catch (error) {
    next(error);
  }
};

supermarketApiController.getSupermarketById = async function (req, res, next) {
  try {
    const supermarketId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(supermarketId)) {
      return res.status(400).json({
        message: "Invalid supermarket ID.",
      });
    }

    const supermarket = await Supermarket.findOne({
      _id: supermarketId,
      approvedByAdmin: true,
    })
      .select(
        "name description location openingHours deliveryMethods deliveryCosts coordinates approvedByAdmin",
      )
      .lean();

    if (!supermarket) {
      return res.status(404).json({
        message: "Supermarket not found.",
      });
    }

    return res.json({
      supermarket,
    });
  } catch (error) {
    next(error);
  }
};

supermarketApiController.listSupermarketProducts = async function (
  req,
  res,
  next,
) {
  try {
    const supermarketId = req.params.id;
    const search = (req.query.search || "").trim();
    const category = (req.query.category || "").trim();
    const sort = (req.query.sort || "name_asc").trim();

    if (!mongoose.Types.ObjectId.isValid(supermarketId)) {
      return res.status(400).json({
        message: "Invalid supermarket ID.",
      });
    }

    if (category && !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        message: "Invalid category ID.",
      });
    }

    const supermarket = await Supermarket.findOne({
      _id: supermarketId,
      approvedByAdmin: true,
    })
      .select("name location deliveryMethods deliveryCosts")
      .lean();

    if (!supermarket) {
      return res.status(404).json({
        message: "Supermarket not found.",
      });
    }

    const filter = {
      supermarketId,
      active: true,
      stock: { $gt: 0 },
    };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (category) {
      filter.categoryId = category;
    }

    const sortOptions = {
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
    };

    const selectedSort = sortOptions[sort] || sortOptions.name_asc;

    const products = await Product.find(filter)
      .populate("categoryId", "name slug")
      .select("name description categoryId price imageUrl stock active supermarketId")
      .sort(selectedSort)
      .lean();

    return res.json({
      supermarket,
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = supermarketApiController;