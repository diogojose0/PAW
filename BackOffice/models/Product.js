const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  supermarketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supermarket',
    required: true
  },
  name: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  price: { type: Number, required: true, min: 0 },
  imageUrl: { type: String, default: '' },
  stock: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);