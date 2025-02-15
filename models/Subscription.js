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
            unique: true,
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

subscriptionSchema.index(
    { userId: 1, orderId: 1 }, 
    { unique: true, name: 'user_order_unique' }
  );

module.exports = model('Subscription', subscriptionSchema);
