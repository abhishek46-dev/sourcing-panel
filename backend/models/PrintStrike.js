const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  name: String,
  fileId: mongoose.Schema.Types.ObjectId,
  url: String,
  key: String,
  bucket: String,
  size: Number,
  type: String,
  comments: Array,
}, { _id: false });

const commentSchema = new mongoose.Schema({
  sender: String,
  message: String,
  time: { type: Date, default: Date.now }
}, { _id: false });

const PrintStrikeSchema = new mongoose.Schema({
  season: { type: String, required: true },
  printStrikeNumber: { type: String, required: true },
  // Legacy inline image if any
  image: String,
  // Primary S3 file reference for preview
  file: fileSchema,
  // Additional files
  files: [fileSchema],
  // Direct S3 fields (optional)
  s3BucketName: String,
  s3Key: String,
  manager: { type: String, required: true },
  createdAt: Date,
  updatedAt: Date,
  comments: [commentSchema],
  selectedTechpack: String
}, { timestamps: true, collection: 'printstrikes' });

module.exports = mongoose.model('PrintStrike', PrintStrikeSchema); 