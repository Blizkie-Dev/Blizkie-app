const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mov'];
const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    // Accept images and common document types
    cb(null, true);
  },
});

// POST /upload
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const mime = req.file.mimetype;
  const type = IMAGE_TYPES.includes(mime) ? 'image' : VIDEO_TYPES.includes(mime) ? 'video' : 'file';
  res.json({
    url: `/uploads/${req.file.filename}`,
    type,
    name: req.file.originalname,
  });
});

module.exports = router;
