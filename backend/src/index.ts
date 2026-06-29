import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from './auth';
import { isAdmin, isViewer } from './middleware';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', 
  passport.authenticate('google', { session: false }),
  (req, res) => {
    res.redirect('/dashboard'); // Mock redirect
  }
);

// Example protected routes
app.get('/admin/data', isAdmin, (req, res) => {
  res.json({ message: 'Welcome admin' });
});

app.get('/viewer/data', isViewer, (req, res) => {
  res.json({ message: 'Welcome viewer' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
