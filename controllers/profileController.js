require('dotenv').config();
const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase'); 
const authenticateToken = require('../middlewares/authMiddleware');
const { google } = require('googleapis');

// Google OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
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
router.get('/auth/google', authenticateToken, (req, res) => {
  const userId = req.userId;
  
  if (!userId) {
      return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  // Set user ID in a cookie
  res.cookie('googleAuthUserId', userId, {
      httpOnly: true,  // Prevent access from JavaScript
      secure: process.env.NODE_ENV === 'production', // Secure flag for HTTPS
      sameSite: 'Lax', // Prevent CSRF attacks
      maxAge: 10 * 60 * 1000 // Expire in 10 minutes
  });

  // Generate Google OAuth2 URL
  const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.send'],
      prompt: 'consent',
  });

  res.json({ authUrl });
});


// Step 2: Handle Google OAuth2 Callback
router.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  const userId = req.cookies.googleAuthUserId; // Retrieve from cookies

  
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required.' });
    }
  
    if (!userId) {
      return res.status(401).json({ message: 'User not found. Please log in again.' });
  }

  try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Save tokens to Firestore
      await db.collection('users').doc(userId).update({
          googleTokens: JSON.stringify(tokens)
      });

      // Clear the cookie after successful authentication
      res.clearCookie('googleAuthUserId');
  
      res.redirect('http://localhost:3001/dashboard');
    } catch (error) {
      console.error('Error during Google OAuth2 callback:', error);
      res.status(500).json({ message: 'Failed to connect Google account.' });
    }
  });
  

module.exports = router;
