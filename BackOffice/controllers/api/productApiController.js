const mongoose = require("mongoose");
const Product = require("../../models/Product");
const Supermarket = require("../../models/Supermarket");

const productApiController = {};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

productApiController.listProducts = async function (req, res, next) {
  try {
    const search = (req.query.search || "").trim();
    const category = (req.query.category || "").trim();
    const supermarket = (req.query.supermarket || "").trim();
    const sort = (req.query.sort || "name_asc").trim();

    if (category && !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        message: "Invalid category ID.",
      });
    }

    if (supermarket && !mongoose.Types.ObjectId.isValid(supermarket)) {
      return res.status(400).json({
        message: "Invalid supermarket ID.",
      });
    }

    const approvedSupermarketFilter = {
      approvedByAdmin: true,
    };

    if (supermarket) {
      approvedSupermarketFilter._id = supermarket;
    }

    const approvedSupermarkets = await Supermarket.find(
      approvedSupermarketFilter,
    )
      .select("_id")
      .lean();

    const approvedSupermarketIds = approvedSupermarkets.map(
      (approvedSupermarket) => approvedSupermarket._id,
    );

    if (approvedSupermarketIds.length === 0) {
      return res.json({
        count: 0,
        products: [],
      });
    }

    const filter = {
      supermarketId: { $in: approvedSupermarketIds },
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
      .populate(
        "supermarketId",
        "name location deliveryMethods deliveryCosts approvedByAdmin",
      )
      .select("name description categoryId price imageUrl stock active supermarketId")
      .sort(selectedSort)
      .lean();

    return res.json({
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

productApiController.compareProductPrices = async function (req, res, next) {
  try {
    const productName = (req.query.name || "").trim();

    if (!productName) {
      return res.status(400).json({
        message: "Product name is required.",
      });
    }

    const approvedSupermarkets = await Supermarket.find({
      approvedByAdmin: true,
    })
      .select("_id")
      .lean();

    const approvedSupermarketIds = approvedSupermarkets.map(
      (supermarket) => supermarket._id,
    );

    if (approvedSupermarketIds.length === 0) {
      return res.json({
        productName,
        count: 0,
        cheapest: null,
        offers: [],
      });
    }

    // Pesquisa parcial:
    // Exemplo: ao pesquisar "banana", encontra "Banana", "Banana da Madeira", "Banana Bio", etc.
    const productNameRegex = new RegExp(escapeRegex(productName), "i");

    const products = await Product.find({
      supermarketId: { $in: approvedSupermarketIds },
      active: true,
      stock: { $gt: 0 },
      name: productNameRegex,
    })
      .populate("categoryId", "name slug")
      .populate("supermarketId", "name location deliveryMethods deliveryCosts")
      .select("name description categoryId price imageUrl stock supermarketId")
      .sort({ price: 1, name: 1 })
      .lean();

    const offers = products.map((product) => ({
      productId: product._id,
      name: product.name,
      description: product.description,
      category: product.categoryId,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock,
      supermarket: product.supermarketId,
    }));

    const cheapestOffer = offers.length > 0 ? offers[0] : null;

    return res.json({
      productName,
      count: offers.length,
      cheapest: cheapestOffer
        ? {
            productId: cheapestOffer.productId,
            name: cheapestOffer.name,
            supermarket: cheapestOffer.supermarket.name,
            price: cheapestOffer.price,
          }
        : null,
      offers,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = productApiController;