const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  role: {
    type: String,
    enum: ['client', 'supermarket', 'courier', 'admin'],
    required: true,
    default: 'client'
  },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);