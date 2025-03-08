const { Schema, model } = require('mongoose');

const userSchema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        phone: { type: String},
        password: { type: String, required: true },
        passwordResetToken: { type: String },
        passwordResetExpires: { type: Date },
        role: { 
          type: String, 
          enum: ['superAdmin', 'admin', 'user'], 
          default: 'user' 
        },
        googleId: { type: String },
        isVerified: { type: Boolean, default: false },
        referralCode: { type: String, unique: true },
        referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
        referralBalance: { type: Number, default: 0 },
        virtualGifts: { type: Number, default: 0 }, 
        totalEarnings: { type: Number, default: 0 },
        withdrawnAmount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Pre-save hook to generate referral code
userSchema.pre('save', async function(next) {
    if (this.role === 'superAdmin' && this.isModified('role')) {
      const existingSuperAdmin = await this.constructor.findOne({ 
          role: 'superAdmin',
          _id: { $ne: this._id }
      });
      if (existingSuperAdmin) {
          throw new Error('Only one superAdmin allowed');
      }
    }

    if (!this.referralCode && this.role === 'user') {
      const generateCode = async () => {
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        return `${this._id.toString().slice(-4)}${random}`;
      };
      
      let code;
      do {
        code = await generateCode();
      } while (await this.constructor.exists({ referralCode: code }));
      
      this.referralCode = code;
    }
    next();
  });
  

module.exports = model('User', userSchema);
