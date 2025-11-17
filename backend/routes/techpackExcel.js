const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
const TechpackExcel = require('../models/TechpackExcel');

// Ensure AWS credentials are loaded via env vars
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// GET: list all techpack excel metadata
router.get('/techpack-excels', async (req, res) => {
  try {
    const docs = await TechpackExcel.find().sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    console.error('Error fetching techpack excels:', err);
    res.status(500).json({ error: 'Failed to fetch excel files' });
  }
});

// GET: presigned url for download/view
router.get('/techpack-excels/:id/url', async (req, res) => {
  try {
    const doc = await TechpackExcel.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const params = {
      Bucket: doc.bucketName,
      Key: doc.s3Key,
      Expires: 60 * 60, // 1 hour
    };
    const url = s3.getSignedUrl('getObject', params);
    res.json({ url });
  } catch (err) {
    console.error('Error generating signed url:', err);
    res.status(500).json({ error: 'Failed to generate url' });
  }
});

module.exports = router;
