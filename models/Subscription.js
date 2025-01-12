const { Schema, model } = require('mongoose');

const subscriptionSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
        },
        screenshot: {
            type: String, 
            required: true,
        },
        verified: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = model('Subscription', subscriptionSchema);
