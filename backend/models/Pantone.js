const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  sender: String,
  message: String,
  time: { type: Date, default: Date.now }
}, { _id: false });

const fileSchema = new mongoose.Schema({
  name: String,
  url: String,
  key: String,
  bucket: String,
  size: Number,
  type: String,
  manager: String,
  selectedTechpack: String,
  uploadedBy: String,
  status: String
}, { _id: false });

const pantoneSchema = new mongoose.Schema({
  season: String,
  pantoneNumber: String,
  image: String, // stores image path or base64 (legacy)
  file: fileSchema, // S3 file object
  s3BucketName: String, // direct S3 bucket reference
  s3Key: String, // direct S3 key reference
  manager: String,
  selectedTechpack: String,
  comments: [commentSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'pantones' });

module.exports = mongoose.model('Pantone', pantoneSchema); 