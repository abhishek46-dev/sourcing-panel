const mongoose = require('mongoose');

const pantoneSchema = new mongoose.Schema({
  pantoneNumber: String,
  colorName: String,
  hex: String,
  _id: mongoose.Schema.Types.ObjectId
}, { _id: false });

const fileSchema = new mongoose.Schema({
  name: String,
  previewUrl: String,
  totalPages: Number
}, { _id: false });

const pantoneLibrarySchema = new mongoose.Schema({
  season: String,
  pantones: [pantoneSchema],
  file: fileSchema,
  uploadedAt: { type: Date, default: Date.now }
}, { collection: 'pantoneLibraries' });

module.exports = mongoose.model('PantoneLibrary', pantoneLibrarySchema); 