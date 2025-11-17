const mongoose = require('mongoose');

const fptReportSchema = new mongoose.Schema({
  season: { type: String, required: true },
  styleId: { type: String, required: true },
  poNumber: { type: String, required: true },
  manager: { type: String, required: true },
  files: [
    {
      name: { type: String, required: true },
      fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true }
    }
  ],
  comments: [
    {
      user: String,
      text: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'PASSED' }
}, { collection: 'fptreports' });

module.exports = mongoose.model('FPTReport', fptReportSchema); 