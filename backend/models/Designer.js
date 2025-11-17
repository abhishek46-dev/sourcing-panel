const mongoose = require('mongoose');

const techPackDetailSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: String,
  colour: String,
  fit: String,
  printTechnique: String,
  status: String,
  id: Number,
}, { _id: false });

const designerSchema = new mongoose.Schema({
  name: String,
  techPacks: Number,
  submittedOn: String,
  techPackDetails: [techPackDetailSchema]
});

module.exports = mongoose.model('Designer', designerSchema); 