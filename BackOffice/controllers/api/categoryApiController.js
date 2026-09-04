const Category = require("../../models/Category");

const categoryApiController = {};

categoryApiController.listCategories = async function (req, res, next) {
  try {
    const search = (req.query.search || "").trim();

    const filter = {
      active: true,
    };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const categories = await Category.find(filter)
      .select("name slug description active")
      .sort({ name: 1 })
      .lean();

    return res.json({
      count: categories.length,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = categoryApiController;