const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  sender: String,
  message: String,
  time: { type: Date, default: Date.now }
}, { _id: false });

const techpackSchema = new mongoose.Schema({
  name: String,
  description: String,
  articletype: String,
  colour: String,
  fit: String,
  gender: String,
  printtechnique: String,
  status: String,
  brandManager: String,
  brand: String,
  styleId: String,
  timestamp: String,
  previewUrl: String,
  pdfview: String,
  totalPages: Number,
  pdfPath: String,
  // If stored on S3
  pdfUrl: String,
  s3Key: String,
  s3BucketName: String,
  pdfOriginalName: String,
  extractedImages: { type: [String], default: [] },
  extractedColors: { type: [String], default: [] },
  comments: [commentSchema]
}, { collection: 'tech--packs' });

module.exports = mongoose.model('Techpack', techpackSchema); 