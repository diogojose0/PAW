const Product = require("../../models/Product");
const Category = require("../../models/Category");
const {
  getCategories,
  getSelectableCategories,
} = require("../../services/categoryService");

async function renderProductFormView(res, options = {}) {
  const categories = await getSelectableCategories(
    options.product?.categoryId || null,
  );

  return res
    .status(options.statusCode || 200)
    .render("supermarket/product-form", {
      title:
        options.title || (options.product ? "Edit Product" : "New Product"),
      product: options.product || null,
      categories,
      error: options.error || null,
    });
}

const productsSupermarketcontroller = {};

productsSupermarketcontroller.productsList = async function (req, res, next) {
  try {
    const supermarket = req.supermarket;

    const search = (req.query.search || "").trim();
    const category = (req.query.category || "").trim();

    const filter = {
      supermarketId: supermarket._id,
    };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (category) {
      filter.categoryId = category;
    }

    const [products, categories] = await Promise.all([
      Product.find(filter).populate("categoryId").sort({ createdAt: -1 }),
      getCategories(),
    ]);

    res.render("supermarket/products", {
      title: "Products",
      supermarket,
      products,
      search,
      category,
      categories,
    });
  } catch (err) {
    next(err);
  }
};

productsSupermarketcontroller.newProductForm = async function (req, res, next) {
  try {
    return await renderProductFormView(res, {
      title: "New Product",
      product: null,
    });
  } catch (err) {
    next(err);
  }
};

productsSupermarketcontroller.createProduct = async function (req, res, next) {
  try {
    const { name, description, categoryId, price, stock } = req.body;

    const productData = {
      name: name?.trim() || "",
      description: description?.trim() || "",
      categoryId: categoryId || "",
      price: Number(price),
      stock: Number(stock),
      imageUrl: "",
    };

    if (
      !productData.name ||
      !productData.categoryId ||
      price === undefined ||
      stock === undefined
    ) {
      return await renderProductFormView(res, {
        statusCode: 400,
        title: "New Product",
        product: productData,
        error: "You must fill in all the required fields.",
      });
    }

    const selectedCategory = await Category.findOne({
      _id: productData.categoryId,
      active: true,
    });

    if (!selectedCategory) {
      return await renderProductFormView(res, {
        statusCode: 400,
        title: "New Product",
        product: productData,
        error: "Invalid category.",
      });
    }

    if (Number.isNaN(productData.price) || productData.price < 0) {
      return await renderProductFormView(res, {
        statusCode: 400,
        title: "New Product",
        product: productData,
        error: "Price must be a valid number greater than or equal to 0.",
      });
    }

    if (!Number.isInteger(productData.stock) || productData.stock < 0) {
      return await renderProductFormView(res, {
        statusCode: 400,
        title: "New Product",
        product: productData,
        error: "Stock must be a valid integer greater than or equal to 0.",
      });
    }

    await Product.create({
      supermarketId: req.supermarket._id,
      name: productData.name,
      description: productData.description,
      categoryId: productData.categoryId,
      price: productData.price,
      imageUrl: req.file ? `/uploads/products/${req.file.filename}` : "",
      stock: productData.stock,
      active: true,
    });

    req.session.flash = {
      type: "success",
      text: "Product created successfully.",
    };

    res.redirect("/supermarket/products");
  } catch (err) {
    next(err);
  }
};

productsSupermarketcontroller.editProductForm = async function (req, res, next) {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      supermarketId: req.supermarket._id,
    }).populate("categoryId");

    if (!product) {
      req.session.flash = {
        type: "danger",
        text: "Product not found.",
      };
      return res.redirect("/supermarket/products");
    }

    return await renderProductFormView(res, {
      title: "Edit Product",
      product,
    });
  } catch (err) {
    next(err);
  }
};

productsSupermarketcontroller.updateProduct = async function (req, res, next) {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      supermarketId: req.supermarket._id,
    });

    if (!product) {
      req.session.flash = {
        type: "danger",
        text: "Product not found.",
      };
      return res.redirect("/supermarket/products");
    }

    const { name, description, categoryId, price, stock } = req.body;

    const productData = {
      ...product.toObject(),
      name: name?.trim() || "",
      description: description?.trim() || "",
      categoryId: categoryId || "",
      price: Number(price),
      stock: Number(stock),
    };

    if (
      !productData.name ||
      !productData.categoryId ||
      price === undefined ||
      stock === undefined
    ) {
      return await renderProductFormView(res, {
        statusCode: 400,
        title: "Edit Product",
        product: productData,
        error: "You must fill in all the required fields.",
      });
    }

    const selectedCategory = await Category.findById(productData.categoryId);

    if (!selectedCategory) {
      return await renderProductFormView(res, {
        statusCode: 400,
        title: "Edit Product",
        product: productData,
        error: "Invalid category.",
      });
    }

    if (Number.isNaN(productData.price) || productData.price < 0) {
      return await renderProductFormView(res, {
        statusCode: 400,
        title: "Edit Product",
        product: productData,
        error: "Price must be a valid number greater than or equal to 0.",
      });
    }

    if (!Number.isInteger(productData.stock) || productData.stock < 0) {
      return await renderProductFormView(res, {
        statusCode: 400,
        title: "Edit Product",
        product: productData,
        error: "Stock must be a valid integer greater than or equal to 0.",
      });
    }

    product.name = productData.name;
    product.description = productData.description;
    product.categoryId = productData.categoryId;
    product.price = productData.price;
    product.stock = productData.stock;

    if (req.file) {
      product.imageUrl = `/uploads/products/${req.file.filename}`;
    }

    await product.save();

    req.session.flash = {
      type: "success",
      text: "Product updated successfully.",
    };

    res.redirect("/supermarket/products");
  } catch (err) {
    next(err);
  }
};

productsSupermarketcontroller.toggleProductActive = async function (req, res, next) {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      supermarketId: req.supermarket._id,
    });

    if (!product) {
      req.session.flash = {
        type: "danger",
        text: "Product not found.",
      };
      return res.redirect("/supermarket/products");
    }

    product.active = !product.active;
    await product.save();

    req.session.flash = {
      type: "success",
      text: `Product ${product.active ? "enabled" : "disabled"} successfully.`,
    };

    res.redirect("/supermarket/products");
  } catch (err) {
    next(err);
  }
};

module.exports = productsSupermarketcontroller;