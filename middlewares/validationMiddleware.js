const { body } = require('express-validator');

// Validation rules for creating an order
const validateOrder = [
    body('youtubeLink')
        .isURL().withMessage('Youtube link must be a valid URL')
        .matches(/^https:\/\/(www\.)?youtube\.com\/.*$/).withMessage('Must be a valid YouTube link'),
    body('thumbnail').isURL().withMessage('Thumbnail must be a valid URL'),
    body('title').isString().trim().notEmpty().withMessage('Title is required'),
    body('amountPaid')
        .isNumeric().withMessage('Amount paid must be a number')
        .isFloat({ min: 0 }).withMessage('Amount paid must be at least 0'),
    body('description').isString().trim().notEmpty().withMessage('Description is required'),
];

// Validation rules for updating an order
const validateOrderUpdate = [
    body('status')
        .isIn(['pending', 'completed', 'canceled'])
        .withMessage('Invalid status value'),
];
const validateScreenshotUpload = [
    body('orderId').notEmpty().withMessage('Order ID is required'),
];

module.exports = { validateOrder, validateOrderUpdate , validateScreenshotUpload};
