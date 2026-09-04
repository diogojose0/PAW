const Category = require("../../models/Category");
const {
  normalizeCategoryName,
  slugifyCategoryName,
  getCategories,
} = require("../../services/categoryService");

const categoryAdminController = {};

function renderCategoryForm(res, options = {}) {
  return res.status(options.statusCode || 200).render("admin/category-form", {
    title:
      options.title || (options.category ? "Edit Category" : "New Category"),
    category: options.category || null,
    error: options.error || null,
  });
}

categoryAdminController.categoriesList = async function (req, res, next) {
  try {
    const categories = await getCategories();

    res.render("admin/categories", {
      title: "Categories",
      categories,
    });
  } catch (err) {
    next(err);
  }
};

categoryAdminController.newCategoryForm = async function (req, res, next) {
  try {
    return renderCategoryForm(res, {
      title: "New Category",
      category: null,
    });
  } catch (err) {
    next(err);
  }
};

categoryAdminController.createCategory = async function (req, res, next) {
  try {
    const name = normalizeCategoryName(req.body.name);
    const description = (req.body.description || "").trim();
    const active = req.body.active === "on";

    const categoryData = {
      name,
      description,
      active,
    };

    if (!categoryData.name) {
      return renderCategoryForm(res, {
        statusCode: 400,
        title: "New Category",
        category: categoryData,
        error: "Category name is required.",
      });
    }

    const slug = slugifyCategoryName(categoryData.name);

    if (!slug) {
      return renderCategoryForm(res, {
        statusCode: 400,
        title: "New Category",
        category: categoryData,
        error: "Invalid category name.",
      });
    }

    const existingCategory = await Category.findOne({ slug });

    if (existingCategory) {
      return renderCategoryForm(res, {
        statusCode: 400,
        title: "New Category",
        category: categoryData,
        error: "A category with this name already exists.",
      });
    }

    await Category.create({
      name: categoryData.name,
      slug,
      description: categoryData.description,
      active: categoryData.active,
    });

    req.session.flash = {
      type: "success",
      text: "Category created successfully.",
    };

    res.redirect("/admin/categories");
  } catch (err) {
    next(err);
  }
};

categoryAdminController.editCategoryForm = async function (req, res, next) {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      req.session.flash = {
        type: "danger",
        text: "Category not found.",
      };
      return res.redirect("/admin/categories");
    }

    return renderCategoryForm(res, {
      title: "Edit Category",
      category,
    });
  } catch (err) {
    next(err);
  }
};

categoryAdminController.updateCategory = async function (req, res, next) {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      req.session.flash = {
        type: "danger",
        text: "Category not found.",
      };
      return res.redirect("/admin/categories");
    }

    const name = normalizeCategoryName(req.body.name);
    const description = (req.body.description || "").trim();
    const active = req.body.active === "on";

    const categoryData = {
      _id: category._id,
      name,
      description,
      active,
    };

    if (!categoryData.name) {
      return renderCategoryForm(res, {
        statusCode: 400,
        title: "Edit Category",
        category: categoryData,
        error: "Category name is required.",
      });
    }

    const slug = slugifyCategoryName(categoryData.name);

    if (!slug) {
      return renderCategoryForm(res, {
        statusCode: 400,
        title: "Edit Category",
        category: categoryData,
        error: "Invalid category name.",
      });
    }

    const existingCategory = await Category.findOne({
      slug,
      _id: { $ne: category._id },
    });

    if (existingCategory) {
      return renderCategoryForm(res, {
        statusCode: 400,
        title: "Edit Category",
        category: categoryData,
        error: "A category with this name already exists.",
      });
    }

    category.name = categoryData.name;
    category.slug = slug;
    category.description = categoryData.description;
    category.active = categoryData.active;

    await category.save();

    req.session.flash = {
      type: "success",
      text: "Category updated successfully.",
    };

    res.redirect("/admin/categories");
  } catch (err) {
    next(err);
  }
};

categoryAdminController.toggleCategoryActive = async function (req, res, next) {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      req.session.flash = {
        type: "danger",
        text: "Category not found.",
      };
      return res.redirect("/admin/categories");
    }

    category.active = !category.active;
    await category.save();

    req.session.flash = {
      type: "success",
      text: `Category ${category.active ? "enabled" : "disabled"} successfully.`,
    };

    res.redirect("/admin/categories");
  } catch (err) {
    next(err);
  }
};

module.exports = categoryAdminController;