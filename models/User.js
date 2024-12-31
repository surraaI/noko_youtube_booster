const { Schema, model } = require('mongoose');

const userSchema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['admin', 'user'], default: 'user' },
        googleId: { type: String },
        virtualGifts: { type: Number, default: 0 }, 
        referredBy: { type: Schema.Types.ObjectId, ref: 'User' }, 
        points: { type: Number, default: 0 }, 
        isVerified: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = model('User', userSchema);
