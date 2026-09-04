const mongoose = require("mongoose");
const Category = require("../models/Category");

const DEFAULT_PRODUCT_CATEGORIES = [
  { name: "fruits and vegetables", description: "" },
  { name: "meat", description: "" },
  { name: "fish", description: "" },
  { name: "drinks", description: "" },
  { name: "cleaning products", description: "" },
  { name: "bakery", description: "" },
];

function normalizeCategoryName(name = "") {
  return String(name).trim().replace(/\s+/g, " ");
}

function slugifyCategoryName(name = "") {
  return normalizeCategoryName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureDefaultCategories() {
  for (const category of DEFAULT_PRODUCT_CATEGORIES) {
    const normalizedName = normalizeCategoryName(category.name);
    const slug = slugifyCategoryName(normalizedName);

    await Category.findOneAndUpdate(
      { slug },
      {
        $setOnInsert: {
          name: normalizedName,
          slug,
          description: category.description,
          active: true,
        },
      },
      {
        upsert: true,
      },
    );
  }
}

async function getCategories({ active } = {}) {
  const filter = {};

  if (typeof active === "boolean") {
    filter.active = active;
  }

  return Category.find(filter).sort({ name: 1 });
}

async function getSelectableCategories(currentCategoryId = null) {
  const activeCategories = await getCategories({ active: true });

  if (!currentCategoryId) {
    return activeCategories;
  }

  const currentId = String(currentCategoryId);
  const alreadyIncluded = activeCategories.some(
    (category) => String(category._id) === currentId,
  );

  if (alreadyIncluded) {
    return activeCategories;
  }

  if (!mongoose.Types.ObjectId.isValid(currentId)) {
    return activeCategories;
  }

  const currentCategory = await Category.findById(currentId);

  if (!currentCategory) {
    return activeCategories;
  }

  return [currentCategory, ...activeCategories];
}

module.exports = {
  DEFAULT_PRODUCT_CATEGORIES,
  normalizeCategoryName,
  slugifyCategoryName,
  ensureDefaultCategories,
  getCategories,
  getSelectableCategories,
};