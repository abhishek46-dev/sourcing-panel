const mongoose = require('mongoose');

const bestSellingStyleSchema = new mongoose.Schema({
  styleId: String,
  vendor: String,
  manager: String,
  color: String,
  fabricType: String,
  fabricContent: String,
  pattern: String,
  gsm: String,
  fileName: String,
  originalFileName: String,
  uploadedDate: Date,
  finalCostByVendor: String,
  finalCostBySourcingManager: String,
  finalQty: String
}, { collection: 'best-selling-styles', strict: false });

module.exports = mongoose.model('BestSellingStyle', bestSellingStyleSchema); 