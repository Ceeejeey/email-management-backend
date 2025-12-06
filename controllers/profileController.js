const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase'); 
const authenticateToken = require('../middlewares/authMiddleware');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

// Google OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : '',
  process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.trim() : '',
  process.env.GOOGLE_REDIRECT_URI ? process.env.GOOGLE_REDIRECT_URI.trim() : ''
);

// Fetch user profile
router.get('/user/profile', authenticateToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const userData = userDoc.data();
    
    // Determine if the user is connected to Google
    const isGoogleConnected = !!userData.googleTokens;

    // Don't send sensitive data like tokens
    const { googleTokens, ...safeUserData } = userData;

    res.status(200).json({ 
      id: userDoc.id, 
      ...safeUserData, 
      isGoogleConnected 
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile.' });
  }
});

// Disconnect Google Account
router.delete('/user/profile/google-connection', authenticateToken, async (req, res) => {
  try {
    const userRef = db.collection('users').doc(req.userId);
    await userRef.update({
      googleTokens: admin.firestore.FieldValue.delete()
    });
    
    res.status(200).json({ message: 'Google account disconnected successfully.' });
  } catch (error) {
    console.error('Error disconnecting Google account:', error);
    res.status(500).json({ message: 'Failed to disconnect Google account.' });
  }
});

// Update user profile
router.put('/user/profile', authenticateToken, async (req, res) => {
  const { name, email } = req.body; // Password update is handled by Firebase Auth on client side usually

  try {
    const userRef = db.collection('users').doc(req.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    // Password updates should be done via Firebase Client SDK

    if (Object.keys(updates).length > 0) {
      await userRef.update(updates);
    }

    res.status(200).json({ message: 'Profile updated successfully!' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Failed to update profile.' });
  }
});

// Step 1: Generate Google Auth URL
// CHANGED ROUTE to bust cache
router.get('/auth/google/init', authenticateToken, (req, res) => {
  const userId = req.userId;
  
  // AGGRESSIVE CACHE BUSTING
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  
  console.error('[APP-DEBUG] Generating Auth URL for User:', userId);
  console.error('[APP-DEBUG] JWT_SECRET Present:', !!process.env.JWT_SECRET);

  if (!userId) {
      return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  try {
    // Generate a secure state token containing the userId
    const state = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.error('[APP-DEBUG] Generated State Token:', state);

    // BACKUP: Set user ID in a cookie
    res.cookie('googleAuthUserId', userId, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 10 * 60 * 1000
    });

    // Generate Google OAuth2 URL
    let authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.send'],
        prompt: 'consent',
        state: state
    });

    // FORCE STATE PARAMETER (Manual Override)
    if (!authUrl.includes('state=')) {
        console.error('[APP-DEBUG] CRITICAL: Library failed to add state. Appending manually.');
        authUrl += `&state=${state}`;
    }

    console.error('[APP-DEBUG] Final Auth URL:', authUrl);

    // Return timestamp to force response body change
    res.json({ authUrl, timestamp: Date.now() });
  } catch (error) {
    console.error('[APP-DEBUG] Error generating auth URL:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Step 2: Handle Google OAuth2 Callback
router.get('/auth/google/callback', async (req, res) => {
  console.error('[APP-DEBUG] Callback received');
  console.error('[APP-DEBUG] Full URL:', req.originalUrl);
  console.error('[APP-DEBUG] Query Params:', JSON.stringify(req.query));

  const { code, state } = req.query;

  if (!code) {
    console.error('[APP-DEBUG] No code provided');
    return res.status(400).json({ message: 'Authorization code is required.' });
  }

  let userId;

  // Verify the state token to retrieve userId
  if (state) {
    console.error('[APP-DEBUG] State parameter found, verifying...');
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      userId = decoded.userId;
      console.error('[APP-DEBUG] State verified, userId:', userId);
    } catch (err) {
      console.error('[APP-DEBUG] Invalid state token:', err.message);
      return res.status(400).json({ message: 'Invalid or expired state parameter.' });
    }
  } else {
    console.error('[APP-DEBUG] No state parameter, falling back to cookies');
    userId = req.cookies.googleAuthUserId;
    console.error('[APP-DEBUG] Cookie userId:', userId);
  }
  
  if (!userId) {
      console.error('[APP-DEBUG] User ID missing from both state and cookies');
      return res.status(401).json({ message: 'User not found. Please log in again.' });
  }

  try {
      console.error('[APP-DEBUG] Attempting to exchange code for tokens...');
      console.error('[APP-DEBUG] Configured Redirect URI:', oauth2Client.redirectUri);
      console.error('[APP-DEBUG] Client ID (first 5):', process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 5) : 'MISSING');
      console.error('[APP-DEBUG] Client Secret length:', process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.length : 'MISSING');
      
      const { tokens } = await oauth2Client.getToken(code);
      console.error('[APP-DEBUG] Tokens received successfully');
      
      oauth2Client.setCredentials(tokens);

      // Save tokens to Firestore
      await db.collection('users').doc(userId).update({
          googleTokens: JSON.stringify(tokens)
      });

      // Clear the cookie if it exists
      res.clearCookie('googleAuthUserId');
  
      const frontendUrl = process.env.BASE_URL || 'https://email-frontend-767837784755.asia-south1.run.app';
      res.redirect(`${frontendUrl}/dashboard`);
    } catch (error) {
      console.error('Error during Google OAuth2 callback:', error);
      res.status(500).json({ message: 'Failed to connect Google account.' });
    }
  });
  

module.exports = router;
