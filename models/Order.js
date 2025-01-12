const { Schema, model } = require('mongoose');

const orderSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        youtubeLink: {
            type: String,
            required: true,
            trim: true,
        },
        thumbnail: {
            type: String,
            required: true,
            trim: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        amountPaid: {
            type: Number,
            required: true,
            min: 0,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        subscribed: {
            type: Number,
            default: 0, // Tracks how many users have subscribed through the app
            min: 0,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'canceled'],
            default: 'pending',
        },
    },
    { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

module.exports = model('Order', orderSchema);
