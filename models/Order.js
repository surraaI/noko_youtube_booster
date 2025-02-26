const { Schema, model } = require('mongoose');

const orderSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        youtubeLink: {
            type: String,
            required: true,
            trim: true,
            validate: {
                validator: v => /^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+/.test(v),
                message: props => `${props.value} is not a valid YouTube link!`
            }
        },
        thumbnail: {
            type: String,
            required: true,
            validate: {
                validator: v => /\.(jpg|jpeg|png|webp)$/.test(v),
                message: 'Thumbnail must be an image file'
            }
        },
        channelName: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 50
        },
        amountPaid: {
            type: Number,
            required: true,
            enum: [500, 1000, 2000, 3000, 4000, 5000, 10000],
            set: function(value) {
                this.subscribersNeeded = Math.floor(value / 10);
                return value;
            }
        },
        paymentScreenshot: {
            type: String,
            required: true,
            validate: {
                validator: v => /\.(jpg|jpeg|png|webp)$/.test(v),
                message: 'Payment proof must be an image file'
            }
        },
        description: {
            type: String,
            required: true,
            trim: true,
            minlength: 10,
            maxlength: 500
        },
        subscribed: {
            type: Number,
            default: 0,
            min: 0
        },
        subscribersNeeded: {
            type: Number,
            required: true,
            min: 50
        },
        status: {
            type: String,
            enum: ['pending', 'active', 'completed', 'canceled'],
            default: 'pending'
        },
        verifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual fields
orderSchema.virtual('remainingSubscribers').get(function() {
    return this.subscribersNeeded - this.subscribed;
});

orderSchema.virtual('progress').get(function() {
    return ((this.subscribed / this.subscribersNeeded) * 100).toFixed(1);
});

// Pre-save validation
orderSchema.pre('save', function(next) {
    if (this.isModified('amountPaid')) {
        this.subscribersNeeded = Math.floor(this.amountPaid / 10);
    }
    
    if (this.status === 'completed' && this.remainingSubscribers > 0) {
        throw new Error('Cannot complete order with remaining subscribers');
    }

    if (this.subscribed > this.subscribersNeeded) {
        throw new Error('Subscribed count cannot exceed needed subscribers');
    }
    
    next();
});

module.exports = model('Order', orderSchema);