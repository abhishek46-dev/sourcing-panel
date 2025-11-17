const mongoose = require('mongoose');

const techpackExcelSchema = new mongoose.Schema({
  s3Key: { type: String, required: true },
  bucketName: { type: String, required: true },
  fileName: { type: String, required: true },
  techpackIds: { type: [String], default: [] },
  manager: String,
  createdAt: { type: Date, default: Date.now }
}, { collection: 'techpackexcels' });

module.exports = mongoose.model('TechpackExcel', techpackExcelSchema);
