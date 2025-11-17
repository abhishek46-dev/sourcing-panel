const mongoose = require('mongoose');

const assortmentDetailSchema = new mongoose.Schema({
  category: String,
  range: String,
  mrp: String,
  mix: String,
  asrp: String,
  ppSegment: String,
  basicFashion: String,
  discount: String,
  depth: String,
  qty: String,
  // Add more fields as needed for your table structure
}, { _id: false });

const assortmentPlanSchema = new mongoose.Schema({
  id: String,
  season: String,
  addedDate: String,
  details: [assortmentDetailSchema]
});

module.exports = mongoose.model('AssortmentPlan', assortmentPlanSchema); 