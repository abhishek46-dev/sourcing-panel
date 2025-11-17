const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  folderName: { type: String, default: 'uploaded files' },
  SourcingManager_name: { type: String, default: 'ABHISHEK' },
  techpackIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Techpack' }],
  files: [{
    fileName: { type: String, required: true },
    key: { type: String, required: true },
    bucketName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  }],
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('File', FileSchema);