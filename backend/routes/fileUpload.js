const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const File = require('../models/File');
const router = express.Router();

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Folder in S3 where tech-pack files will be stored
const UPLOAD_FOLDER = 'uploaded files';

// POST endpoint to upload files
router.post('/upload-techpack-files', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;
    const bucketName = process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET;
    const techpackIds = req.body.techpackIds ? JSON.parse(req.body.techpackIds) : [];

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const fileMeta = [];

    await Promise.all(
      files.map(async (file) => {
        const params = {
          Bucket: bucketName,
          Key: `${UPLOAD_FOLDER}/${Date.now()}-${file.originalname}`,
          Body: file.buffer,
        };

        const uploadResult = await s3.upload(params).promise();
        fileMeta.push({
          fileName: file.originalname,
          key: uploadResult.Key,
          bucketName: bucketName,
        });
      })
    );

    // Save single document containing all uploaded files
    const fileDoc = new File({ files: fileMeta, techpackIds, folderName: UPLOAD_FOLDER });
    await fileDoc.save();

    res.status(200).json({ message: 'Files uploaded successfully', files: fileDoc.files, id: fileDoc._id });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ message: 'Error uploading files', error });
  }
});

module.exports = router;