import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    // In a real app, you'd find or create the user in the database here
    // And assign a role (Admin or Viewer)
    const user = {
      id: profile.id,
      displayName: profile.displayName,
      email: profile.emails?.[0].value,
      role: 'admin' // Default to admin for now, should be based on DB
    };
    return done(null, user);
  }
));

export default passport;
