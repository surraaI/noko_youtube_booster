// In upload.js
const multer = require('multer');
const { storage } = require('../utils/cloudinary');

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  allowedMimeTypes.includes(file.mimetype) 
    ? cb(null, true) 
    : cb(new Error('Invalid file type. Only JPEG, PNG, and JPG are allowed.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB
  }
});

module.exports = { upload };