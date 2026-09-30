const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const passport = require('passport');

const { User } = require('../models');
const { getJwtSecret } = require('./jwt');

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKeyProvider: (_req, _rawToken, done) => {
    try {
      done(null, getJwtSecret());
    } catch (error) {
      done(error);
    }
  },
};

passport.use(
  new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
      const user = await User.findByPk(jwt_payload.id);
      if (!user) {
        return done(null, false);
      }
      if (Number(jwt_payload.sessionVersion || 0) !== Number(user.sessionVersion || 0)) {
        return done(null, false);
      }
      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  })
);

module.exports = passport;
