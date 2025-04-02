const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
};

module.exports = (passport) => {
    // JWT Strategy
    passport.use(
        new JwtStrategy(jwtOptions, async (payload, done) => {
            try {
                const user = await User.findById(payload.id);
                return user ? done(null, user) : done(null, false);
            } catch (error) {
                return done(error, false);
            }
        })
    );
};