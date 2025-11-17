const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, required: true },
  status: { type: String, default: 'PENDING' }
});

module.exports = mongoose.model('Vendor', vendorSchema); 