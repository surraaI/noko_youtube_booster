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
            type: {
                url: { type: String, required: true },
                public_id: { type: String, required: true }
            },
            required: true
        },
        verified: {
            type: Boolean,
            default: false,
        },
    },
    { 
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true }
    }
);

// Compound unique index
subscriptionSchema.index(
    { userId: 1, orderId: 1 }, 
    { 
        unique: true, 
        name: 'user_order_unique',
        partialFilterExpression: {
            verified: { $eq: true }
        }
    }
);

module.exports = model('Subscription', subscriptionSchema);