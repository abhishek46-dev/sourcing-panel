const mongoose = require('mongoose');

const managerSchema = new mongoose.Schema({
  name: String,
  total: Number,
  date: String
});

module.exports = mongoose.model('Manager', managerSchema); 