require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const fileUploadRoutes = require('./routes/fileUpload');
const { GridFSBucket } = require('mongodb');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

// Debugging: Log MONGODB_URI to verify environment variable
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // Enable CORS for all routes

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api', fileUploadRoutes);
const techpackExcelRoutes = require('./routes/techpackExcel');
app.use('/api', techpackExcelRoutes);

// PreProduction endpoints
const PreProduction = require('./models/PreProduction');
const PantoneLibrary = require('./models/PantoneLibrary');

// Pantone Library API: Get by season
app.get('/api/pantone-library', async (req, res) => {
  try {
    const season = req.query.season;
    if (!season) return res.status(400).json({ error: 'Missing season parameter' });
    const doc = await PantoneLibrary.findOne({ season });
    if (!doc) return res.json({ pantones: [], file: null });
    // Only return necessary fields to avoid header overflow
    const pantones = (doc.pantones || []).map(p => ({
      pantoneNumber: p.pantoneNumber,
      colorName: p.colorName,
      hex: p.hex,
      _id: p._id
    }));
    let file = null;
    if (doc.file) {
      file = {
        name: doc.file.name,
        previewUrl: doc.file.previewUrl,
        totalPages: doc.file.totalPages,
        uploadedAt: doc.uploadedAt
      };
    }
    res.json({ pantones, file });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Pantone Library' });
  }
});

// Get all preproduction records
app.get('/api/preproduction', async (req, res) => {
  try {
    const records = await PreProduction.find();
    res.json(records);
  } catch (err) {
    console.error('Error fetching preproduction records:', err);
    res.status(500).json({ error: 'Failed to fetch preproduction records' });
  }
});

// Serve PreProduction image via secure S3 proxy or legacy storage
app.get('/api/preproduction/:id/image', async (req, res) => {
  try {
    const preprod = await PreProduction.findById(req.params.id);
    if (!preprod) return res.status(404).send('PreProduction not found');

    // Prefer S3
    let key = preprod.file?.key || preprod.s3Key;
    let bucket = preprod.file?.bucket || preprod.s3BucketName || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
    if (key && bucket && s3) {
      try {
        const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
        const s3Client = new S3Client({ region: process.env.AWS_REGION });
        const obj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        res.setHeader('Content-Type', obj.ContentType || preprod.file?.type || 'image/jpeg');
        if (preprod.file?.name) {
          res.setHeader('Content-Disposition', `inline; filename="${preprod.file.name}"`);
        }
        return obj.Body.pipe(res);
      } catch (s3Err) {
        console.error('S3 stream failed for preproduction image:', s3Err.message);
        return res.status(500).send('Failed to fetch image from S3');
      }
    }

    // Legacy: base64 or local file
    if (preprod.image && preprod.image.startsWith('data:image')) {
      let base64Data = preprod.image.split(',')[1];
      let mime = preprod.image.split(';')[0].split(':')[1];
      res.setHeader('Content-Type', mime);
      return res.end(Buffer.from(base64Data, 'base64'));
    }
    if (preprod.image && /^[A-Za-z0-9+/=]+$/.test(preprod.image.substring(0, 100))) {
      let mime = 'image/jpeg';
      if (preprod.image.startsWith('iVBOR')) mime = 'image/png';
      res.setHeader('Content-Type', mime);
      return res.end(Buffer.from(preprod.image, 'base64'));
    }
    if (preprod.image) {
      const path = require('path');
      const fs = require('fs');
      const imagePath = path.join(__dirname, 'uploads', preprod.image);
      if (fs.existsSync(imagePath)) {
        return res.sendFile(imagePath);
      }
    }
    return res.status(404).send('Image not available');
  } catch (err) {
    console.error('Error serving preproduction image:', err);
    res.status(500).send('Failed to fetch image');
  }
});

// HEAD endpoint for preproduction image availability
app.head('/api/preproduction/:id/image', async (req, res) => {
  try {
    const preprod = await PreProduction.findById(req.params.id);
    if (!preprod) return res.status(404).end();
    let key = preprod.file?.key || preprod.s3Key;
    let bucket = preprod.file?.bucket || preprod.s3BucketName || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
    if (key && bucket && s3) {
      try {
        const { HeadObjectCommand, S3Client } = require('@aws-sdk/client-s3');
        const s3Client = new S3Client({ region: process.env.AWS_REGION });
        await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return res.status(200).end();
      } catch (s3Err) {
        return res.status(404).end();
      }
    }
    // Check legacy
    if (preprod.image && preprod.image.startsWith('data:image')) return res.status(200).end();
    if (preprod.image && /^[A-Za-z0-9+/=]+$/.test(preprod.image.substring(0, 100))) return res.status(200).end();
    if (preprod.image) {
      const path = require('path');
      const fs = require('fs');
      const imagePath = path.join(__dirname, 'uploads', preprod.image);
      if (fs.existsSync(imagePath)) return res.status(200).end();
    }
    return res.status(404).end();
  } catch (err) {
    res.status(404).end();
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});



const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  Bucket: process.env.S3_BUCKET_NAME, 
});



// const app = require('./app');
const AssortmentPlan = require('./models/AssortmentPlan');
const Techpack = require('./models/Techpack');
const Pantone = require('./models/Pantone');
const Vendor = require('./models/Vendor');
const BestSellingStyle = require('./models/BestSellingStyle');
const PrintStrike = require('./models/PrintStrike');
const FPTReport = require('./models/FPTReport');
const GPTReport = require('./models/GPTReport');
// Duplicate PantoneLibrary require removed; already declared earlier.
// const PantoneLibrary = require('./models/PantoneLibrary');
const fs = require('fs');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const http = require('http');
const https = require('https');
require('dotenv').config();
const upload = multer({ storage: multer.memoryStorage() });
// Helper: fetch object from S3
async function getObjectFromS3(bucket, key) {
  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  });
  return await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}

// Get all assortment plans
app.get('/api/assortment-plans', async (req, res) => {
  try {
    const plans = await AssortmentPlan.find();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single assortment plan by id
app.get('/api/assortment-plans/:id', async (req, res) => {
  try {
    const plan = await AssortmentPlan.findOne({ id: req.params.id });
    if (!plan) return res.status(404).json({ error: 'Not found' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all techpacks with selected metadata and a proxy pdf link
app.get('/api/tech--packs', async (req, res) => {
  try {
    const projection = {
      pdfPath: 1,
      pdfOriginalName: 1,
      name: 1,
      description: 1,
      articletype: 1,
      colour: 1,
      fit: 1,
      gender: 1,
      printtechnique: 1,
      status: 1,
      brandManager: 1,
      brand: 1,
      styleId: 1,
      timestamp: 1,
      previewUrl: 1,
      pdfview: 1,
      totalPages: 1,
      s3Key: 1,
      pdfUrl: 1,
      extractedImages: 1,
      extractedColors: 1,
    };

    const techpacks = await Techpack.find({ status: 'ACCEPTED' }, projection).lean();
    const result = techpacks.map(tp => ({
      ...tp,
      // Always provide a backend proxy link that handles local path / S3 / remote url
      pdfUrl: `http://localhost:${PORT}/api/tech--packs/pdf/${tp._id}`,
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching techpacks:', err);
    res.status(500).json({ error: 'Failed to retrieve techpacks' });
  }
});

// Get all accepted techpacks for a brand manager
app.get('/api/tech--packs/brand/:brandManager', async (req, res) => {
  try {
    const techpacks = await Techpack.find({ status: 'ACCEPTED', brandManager: req.params.brandManager });
    res.json(techpacks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch techpacks' });
  }
});

// Serve PDF for preview (stub, adjust path as needed)
app.get('/api/tech--packs/pdf/:id', async (req, res) => {
  try {
    const techpack = await Techpack.findById(req.params.id);
    if (!techpack) return res.status(404).send('Techpack not found');

    // 1) If file is on local filesystem
    if (techpack.pdfPath && !techpack.s3Key) {
      return res.sendFile(path.resolve(techpack.pdfPath));
    }

    // 2) If stored in S3, stream via server using AWS SDK (no URL exposed)
    if (techpack.s3Key || techpack.s3BucketName || (techpack.pdfUrl && techpack.pdfUrl.includes('amazonaws.com'))) {
      try {
        // Resolve bucket/key/region: prefer env; else parse from pdfUrl, supporting both virtual-hosted and path styles
        let bucket = techpack.s3BucketName || process.env.S3_BUCKET || '';
        let key = techpack.s3Key || '';
        let region = process.env.AWS_REGION || '';
        if ((!bucket || !key || !region) && techpack.pdfUrl) {
          try {
            const u = new URL(techpack.pdfUrl);
            const hostParts = u.hostname.split('.');
            // virtual-hosted-style: <bucket>.s3.<region>.amazonaws.com
            if (hostParts[1] === 's3') {
              bucket = bucket || hostParts[0];
              region = region || hostParts[2];
              key = key || decodeURIComponent(u.pathname.replace(/^\//, ''));
            } else if (hostParts[0] === 's3') {
              // path-style: s3.<region>.amazonaws.com/<bucket>/<key>
              region = region || hostParts[1];
              const pathParts = decodeURIComponent(u.pathname.replace(/^\//, '')).split('/');
              if (!bucket && pathParts.length > 1) {
                bucket = pathParts.shift();
                key = key || pathParts.join('/');
              }
            }
          } catch {}
        }
        const s3 = new S3Client({
          region: region || 'us-east-1',
          credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          } : undefined,
        });
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
          return res.status(403).send('S3 access not configured');
        }
        if (!bucket || !key) throw new Error('S3 bucket/key not resolved');
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        res.setHeader('Content-Type', obj.ContentType || 'application/pdf');
        if (techpack.pdfOriginalName) {
          res.setHeader('Content-Disposition', `inline; filename="${techpack.pdfOriginalName}"`);
        }
        return obj.Body.pipe(res);
      } catch (s3Err) {
        console.error('S3 stream failed, falling back to url proxy if present:', s3Err.code || s3Err.name || s3Err.message);
        // fallthrough to URL proxy below
      }
    }

    // 3) Fallback: proxy a public/accessible remote URL if available
    const remoteUrl = techpack.pdfview || techpack.pdfUrl || techpack.previewUrl;
    if (remoteUrl && /^https?:\/\//i.test(remoteUrl)) {
      const client = remoteUrl.startsWith('https') ? https : http;
      const reqUpstream = client.get(remoteUrl, (upstream) => {
        if (upstream.statusCode && upstream.statusCode >= 400) {
          return res.status(502).send('Upstream pdf unavailable');
        }
        res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/pdf');
        upstream.pipe(res);
      });
      reqUpstream.on('error', (e) => {
        console.error('Proxy fetch failed:', e.message);
        res.status(500).send('Failed to fetch PDF');
      });
      return;
    }

    return res.status(404).send('PDF not available');
  } catch (err) {
    console.error('Error serving techpack pdf:', err);
    res.status(500).send('Failed to fetch PDF');
  }
});

// HEAD endpoint for availability checks from frontend
app.head('/api/tech--packs/pdf/:id', async (req, res) => {
  try {
    const techpack = await Techpack.findById(req.params.id);
    if (!techpack) return res.status(404).end();

    // Local file present?
    if (techpack.pdfPath && !techpack.s3Key) {
      const abs = path.resolve(techpack.pdfPath);
      if (fs.existsSync(abs)) return res.status(200).end();
    }

    // S3 object present?
    if (techpack.s3Key || techpack.s3BucketName || (techpack.pdfUrl && techpack.pdfUrl.includes('amazonaws.com'))) {
      try {
        let bucket = techpack.s3BucketName || process.env.S3_BUCKET || '';
        let key = techpack.s3Key || '';
        let region = process.env.AWS_REGION || '';
        if ((!bucket || !key || !region) && techpack.pdfUrl) {
          try {
            const u = new URL(techpack.pdfUrl);
            const hostParts = u.hostname.split('.');
            if (hostParts[1] === 's3') {
              bucket = bucket || hostParts[0];
              region = region || hostParts[2];
              key = key || decodeURIComponent(u.pathname.replace(/^\//, ''));
            } else if (hostParts[0] === 's3') {
              region = region || hostParts[1];
              const pathParts = decodeURIComponent(u.pathname.replace(/^\//, '')).split('/');
              if (!bucket && pathParts.length > 1) {
                bucket = pathParts.shift();
                key = key || pathParts.join('/');
              }
            }
          } catch {}
        }
        if (bucket && key && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
          const s3 = new S3Client({ region });
          await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          return res.status(200).end();
        }
      } catch (e) {
        // fall back to remote check
      }
    }

    // Remote URL reachable?
    const remoteUrl = techpack.pdfview || techpack.pdfUrl || techpack.previewUrl;
    if (remoteUrl && /^https?:\/\//i.test(remoteUrl)) {
      const client = remoteUrl.startsWith('https') ? https : http;
      const reqUpstream = client.request(remoteUrl, { method: 'HEAD' }, (up) => {
        if (up.statusCode && up.statusCode < 400) return res.status(200).end();
        return res.status(502).end();
      });
      reqUpstream.on('error', () => res.status(502).end());
      reqUpstream.end();
      return;
    }

    return res.status(404).end();
  } catch (err) {
    return res.status(500).end();
  }
});

// Serve Pantone image via secure S3 proxy
app.get('/api/pantone/image/:id', async (req, res) => {
  try {
    const pantone = await Pantone.findById(req.params.id);
    if (!pantone) return res.status(404).send('Pantone not found');

    // 1) Legacy: local image or base64
    if (pantone.image && !pantone.s3Key && !pantone.file?.key) {
      if (pantone.image.startsWith('data:image')) {
        return res.send(pantone.image);
      }
      // Try local file path
      const imgPath = path.join(__dirname, 'public', 'images', pantone.image);
      if (fs.existsSync(imgPath)) {
        return res.sendFile(imgPath);
      }
    }

    // 2) S3 streaming via file object or direct s3Key
    const s3Key = pantone.file?.key || pantone.s3Key;
    const s3Bucket = pantone.file?.bucket || pantone.s3BucketName || process.env.S3_BUCKET;
    
    if (s3Key && s3Bucket) {
      try {
        const s3 = new S3Client({
          region: process.env.AWS_REGION,
          credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          } : undefined,
        });
        
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
          return res.status(403).send('S3 access not configured');
        }
        
        const obj = await s3.send(new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
        res.setHeader('Content-Type', obj.ContentType || 'image/jpeg');
        if (pantone.file?.name) {
          res.setHeader('Content-Disposition', `inline; filename="${pantone.file.name}"`);
        }
        return obj.Body.pipe(res);
      } catch (s3Err) {
        console.error('S3 stream failed for pantone image:', s3Err.message);
        return res.status(500).send('Failed to fetch image from S3');
      }
    }

    return res.status(404).send('Image not available');
  } catch (err) {
    console.error('Error serving pantone image:', err);
    res.status(500).send('Failed to fetch image');
  }
});

// HEAD endpoint for pantone image availability
app.head('/api/pantone/image/:id', async (req, res) => {
  try {
    const pantone = await Pantone.findById(req.params.id);
    if (!pantone) return res.status(404).end();

    // Check local file
    if (pantone.image && !pantone.s3Key && !pantone.file?.key) {
      if (pantone.image.startsWith('data:image')) {
        return res.status(200).end();
      }
      const imgPath = path.join(__dirname, 'public', 'images', pantone.image);
      if (fs.existsSync(imgPath)) {
        return res.status(200).end();
      }
    }

    // Check S3 object
    const s3Key = pantone.file?.key || pantone.s3Key;
    const s3Bucket = pantone.file?.bucket || pantone.s3BucketName || process.env.S3_BUCKET;
    
    if (s3Key && s3Bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const s3 = new S3Client({ region: process.env.AWS_REGION });
        await s3.send(new HeadObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
        return res.status(200).end();
      } catch (e) {
        // fall through to 404
      }
    }

    return res.status(404).end();
  } catch (err) {
    return res.status(500).end();
  }
});

// Endpoint to stream any S3 object by key (secured, no URL exposure)
app.get('/api/s3/object', async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) return res.status(400).send('Missing key');
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      } : undefined,
    });
    const bucket = process.env.S3_BUCKET;
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    res.setHeader('Content-Type', obj.ContentType || 'application/octet-stream');
    return obj.Body.pipe(res);
  } catch (err) {
    console.error('Error streaming S3 object:', err);
    res.status(500).send('Failed to fetch object');
  }
});

// Send to vendor (stub)
app.post('/api/tech--packs/send-to-vendor', async (req, res) => {
  // req.body: { techpackIds: [], vendorId: ... }
  // Implement your logic here
  res.json({ success: true });
});

// Helper to get base64 image
function getBase64Image(imageField) {
  if (!imageField) return null;
  if (imageField.startsWith('data:image')) return imageField; // already data URL
  // If it's a base64 string without prefix, add a default prefix
  if (/^[A-Za-z0-9+/=]+={0,2}$/.test(imageField.trim())) {
    return `data:image/jpeg;base64,${imageField.trim()}`;
  }
  // If it's a file path, read and convert
  const imgPath = path.join(__dirname, 'public', 'images', imageField);
  try {
    const imgData = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).slice(1) || 'png';
    return `data:image/${ext};base64,${imgData.toString('base64')}`;
  } catch {
    return null;
  }
}

// Get all Pantone records
app.get('/api/pantone', async (req, res) => {
  try {
    const projection = {
      season: 1,
      pantoneNumber: 1,
      image: 1,
      file: 1,
      s3BucketName: 1,
      s3Key: 1,
      manager: 1,
      selectedTechpack: 1,
      comments: 1,
      createdAt: 1,
      updatedAt: 1
    };
    
    const docs = await Pantone.find({}, projection).lean();
    const safe = docs.map(p => ({
      _id: p._id,
      season: p.season,
      pantoneNumber: p.pantoneNumber,
      manager: p.manager,
      selectedTechpack: p.selectedTechpack,
      status: p.status,
      file: p.file ? { name: p.file.name, size: p.file.size, type: p.file.type } : undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      imageUrl: `http://localhost:${PORT}/api/pantones/${p._id}/image`
    }));
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single Pantone by id
app.get('/api/pantone/:id', async (req, res) => {
  try {
    const pantone = await Pantone.findById(req.params.id);
    if (!pantone) return res.status(404).json({ error: 'Not found' });
    const obj = pantone.toObject();
    obj.imageUrl = `http://localhost:${PORT}/api/pantones/${obj._id}/image`;
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all Pantones for a sourcing manager
app.get('/api/pantone/manager/:manager', async (req, res) => {
  try {
    const pantones = await Pantone.find({ manager: req.params.manager });
    const safe = pantones.map(p => ({
      _id: p._id,
      season: p.season,
      pantoneNumber: p.pantoneNumber,
      manager: p.manager,
      selectedTechpack: p.selectedTechpack,
      status: p.status,
      file: p.file ? { name: p.file.name, size: p.file.size, type: p.file.type } : undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      imageUrl: `http://localhost:${PORT}/api/pantones/${p._id}/image`
    }));
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New plural Pantone endpoints for S3-safe access
// Get all pantones (safe metadata only, with proxy imageUrl)
app.get('/api/pantones', async (req, res) => {
  try {
    const pantones = await Pantone.find();
    const safe = pantones.map(p => ({
      _id: p._id,
      season: p.season,
      pantoneNumber: p.pantoneNumber,
      manager: p.manager,
      selectedTechpack: p.selectedTechpack,
      status: p.status,
      file: p.file ? { name: p.file.name, size: p.file.size, type: p.file.type } : undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      imageUrl: `http://localhost:${PORT}/api/pantones/${p._id}/image`
    }));
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pantones' });
  }
});

// Stream pantone image from S3 or legacy storage (proxy, no direct URL exposure)
app.get('/api/pantones/:id/image', async (req, res) => {
  try {
    const pantone = await Pantone.findById(req.params.id);
    if (!pantone) return res.status(404).send('Image not found');

    // Prefer S3
    let key = (pantone.file && pantone.file.key) || pantone.s3Key;
    if (!key && pantone.file && pantone.file.url) {
      try {
        const u = new URL(pantone.file.url);
        key = decodeURIComponent(u.pathname.replace(/^\//, ''));
      } catch (e) {}
    }
    let bucket = (pantone.file && pantone.file.bucket) || pantone.s3BucketName || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
    if (key && bucket) {
      try {
        const s3Object = await getObjectFromS3(bucket, key);
        let contentType = s3Object.ContentType || pantone.file?.type;
        if (!contentType) {
          const lower = key.toLowerCase();
          if (lower.endsWith('.png')) contentType = 'image/png';
          else if (lower.endsWith('.webp')) contentType = 'image/webp';
          else contentType = 'image/jpeg';
        }
        res.setHeader('Content-Type', contentType);
        if (s3Object.ContentLength) res.setHeader('Content-Length', s3Object.ContentLength);
        return s3Object.Body.pipe(res);
      } catch (err) {
        console.error('Pantone S3 stream error:', err.message || err);
        // fall through to legacy handling
      }
    }

    // Legacy paths/base64
    if (pantone.image && pantone.image.startsWith('data:image')) {
      let base64Data = pantone.image.split(',')[1];
      let mime = pantone.image.split(';')[0].split(':')[1];
      res.setHeader('Content-Type', mime);
      return res.end(Buffer.from(base64Data, 'base64'));
    }
    if (pantone.image && /^[A-Za-z0-9+/=]+$/.test(pantone.image.substring(0, 100))) {
      let mime = 'image/jpeg';
      if (pantone.image.startsWith('iVBOR')) mime = 'image/png';
      res.setHeader('Content-Type', mime);
      return res.end(Buffer.from(pantone.image, 'base64'));
    }
    if (pantone.image) {
      const imagePath = path.join(__dirname, 'uploads', pantone.image);
      if (fs.existsSync(imagePath)) {
        return res.sendFile(imagePath);
      }
    }
    res.status(404).send('Image not found');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vendor endpoints
app.get('/api/vendors', async (req, res) => {
  try {
    const vendors = await Vendor.find();
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  try {
    const { name, mobile, email } = req.body;
    const vendor = new Vendor({ name, mobile, email });
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/vendors', async (req, res) => {
  try {
    const { ids } = req.body; // expects { ids: [id1, id2, ...] }
    await Vendor.deleteMany({ _id: { $in: ids } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// User endpoint (as in users.js)
app.get('/api/users', function(req, res) {
  res.send('respond with a resource');
});

// Get all best selling styles
app.get('/api/best-selling-styles', async (req, res) => {
  try {
    const styles = await BestSellingStyle.find();
    res.json(styles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test error logging route
app.get('/api/test-error', (req, res) => {
  try {
    throw new Error('This is a test error!');
  } catch (err) {
    console.error('Test Error:', err.stack || err);
    res.status(500).json({ error: err.message });
  }
});

let gfsBucket;
mongoose.connection.once('open', () => {
  gfsBucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
});

app.get('/api/file/:id', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const fileId = new ObjectId(req.params.id);
    gfsBucket.openDownloadStream(fileId)
      .on('error', () => res.status(404).send('File not found'))
      .pipe(res);
  } catch {
    res.status(400).send('Invalid file id');
  }
});

const isValidObjectId = (id) => {
  return /^[a-fA-F0-9]{24}$/.test(id);
};

app.patch('/api/best-selling-styles/:id/final-order', async (req, res) => {
  try {
    const updateFields = req.body;
    const id = req.params.id;
    const query = isValidObjectId(id) ? { _id: mongoose.Types.ObjectId(id) } : { _id: id };
    const updated = await BestSellingStyle.findOneAndUpdate(
      query,
      updateFields,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all PrintStrike records (safe metadata + proxy imageUrl)
app.get('/api/printstrike', async (req, res) => {
  try {
    const docs = await PrintStrike.find().lean();
    const safe = docs.map(p => ({
      _id: p._id,
      season: p.season,
      printStrikeNumber: p.printStrikeNumber,
      manager: p.manager,
      selectedTechpack: p.selectedTechpack,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      file: p.file ? { name: p.file.name, size: p.file.size, type: p.file.type } : undefined,
      imageUrl: `http://localhost:${PORT}/api/printstrike/${p._id}/image`
    }));
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single PrintStrike by id
app.get('/api/printstrike/:id', async (req, res) => {
  try {
    const p = await PrintStrike.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const obj = p.toObject();
    obj.imageUrl = `http://localhost:${PORT}/api/printstrike/${obj._id}/image`;
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stream PrintStrike image from S3 or legacy storage
app.get('/api/printstrike/:id/image', async (req, res) => {
  try {
    const doc = await PrintStrike.findById(req.params.id);
    if (!doc) return res.status(404).send('Image not found');

    // Resolve S3 bucket/key
    let key = doc.file?.key || doc.s3Key;
    if (!key && doc.file?.url) {
      try { const u = new URL(doc.file.url); key = decodeURIComponent(u.pathname.replace(/^\//, '')); } catch {}
    }
    let bucket = doc.file?.bucket || doc.s3BucketName || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
    // Fallback to first file with key/bucket in files[]
    if ((!key || !bucket) && Array.isArray(doc.files)) {
      const withS3 = doc.files.find(f => f?.key && (f.bucket || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.S3_BUCKET));
      if (withS3) {
        key = key || withS3.key;
        bucket = bucket || withS3.bucket || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
      }
    }

    if (key && bucket) {
      try {
        const s3Object = await getObjectFromS3(bucket, key);
        res.setHeader('Content-Type', s3Object.ContentType || doc.file?.type || 'image/jpeg');
        if (s3Object.ContentLength) res.setHeader('Content-Length', s3Object.ContentLength);
        return s3Object.Body.pipe(res);
      } catch (e) {
        const msg = e.name === 'AccessDenied' || e.$metadata?.httpStatusCode === 403 ? 'S3 access denied' : (e.message || 'S3 error');
        console.error('PrintStrike S3 stream error:', msg);
        if (msg === 'S3 access denied') return res.status(403).send(msg);
      }
    }

    if (doc.image && doc.image.startsWith('data:image')) {
      const base64Data = doc.image.split(',')[1];
      const mime = doc.image.split(';')[0].split(':')[1];
      res.setHeader('Content-Type', mime);
      return res.end(Buffer.from(base64Data, 'base64'));
    }
    if (doc.image && /^[A-Za-z0-9+/=]+$/.test(doc.image.substring(0, 100))) {
      res.setHeader('Content-Type', 'image/jpeg');
      return res.end(Buffer.from(doc.image, 'base64'));
    }
    return res.status(404).send('Image not found');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





app.post('/api/upload-techpack-files', upload.array('files'), async (req, res) => {
  try {
    const uploadResults = [];

    for (const file of req.files) {
      const params = {
        Bucket: process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET, // resolved bucket name
        Key: `techpacks/${Date.now()}-${file.originalname}`,
        Body: file.buffer,
      };

      const uploadResult = await s3.upload(params).promise();
      uploadResults.push(uploadResult);
    }

    res.json({ message: "Files uploaded successfully", files: uploadResults });
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).json({ error: error.message || "Failed to upload files" });
  }
});


// HEAD for printstrike image availability
app.head('/api/printstrike/:id/image', async (req, res) => {
  try {
    const doc = await PrintStrike.findById(req.params.id);
    if (!doc) return res.status(404).end();
    let key = doc.file?.key || doc.s3Key;
    let bucket = doc.file?.bucket || doc.s3BucketName || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
    if ((!key || !bucket) && Array.isArray(doc.files)) {
      const withS3 = doc.files.find(f => f?.key && (f.bucket || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.S3_BUCKET));
      if (withS3) {
        key = key || withS3.key;
        bucket = bucket || withS3.bucket || process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.S3_BUCKET;
      }
    }
    if (key && bucket) {
      try {
        const s3 = new S3Client({ region: process.env.AWS_REGION });
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return res.status(200).end();
      } catch (e) {
        // fall through to 404
      }
    }
    return res.status(404).end();
  } catch (err) {
    return res.status(500).end();
  }
});