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

const PreProductionSchema = new mongoose.Schema({
  season: { type: String, required: true },
  pantoneNumber: { type: String, required: true },
  image: String,
  file: fileSchema,
  files: [fileSchema],
  s3BucketName: String,
  s3Key: String,
  manager: { type: String, required: true },
  createdAt: Date,
  updatedAt: Date,
  comments: [commentSchema]
}, { timestamps: true, collection: 'preproductions' });

module.exports = mongoose.model('PreProduction', PreProductionSchema); 