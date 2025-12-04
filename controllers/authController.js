const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authenticateToken = require('../middlewares/authMiddleware');

// Sign-up logic - Save user to Firestore
router.post('/signup', authenticateToken, async (req, res) => {
    const { name, email } = req.body;
    const userId = req.userId;

    try {
        // Create or update user document in Firestore
        await db.collection('users').doc(userId).set({
            name: name || null,
            email: email || null,
            createdAt: new Date().toISOString(),
            isVerified: false 
        }, { merge: true });

        res.status(201).json({ message: 'User profile created successfully.' });
    } catch (err) {
        console.error('Error during signup:', err);
        res.status(500).json({ message: 'Error while creating user profile', error: err.message });
    }
});

// Google Login logic - Sync user to Firestore
router.post('/google-login', authenticateToken, async (req, res) => {
    const { name, email, photoURL } = req.body;
    const userId = req.userId;

    try {
        // Create or update user document in Firestore
        // Firestore does not accept 'undefined', so we fallback to null
        await db.collection('users').doc(userId).set({
            name: name || null,
            email: email || null,
            photoURL: photoURL || null,
            lastLogin: new Date().toISOString(),
            isVerified: true 
        }, { merge: true });

        res.status(200).json({ message: 'User logged in with Google successfully.' });
    } catch (err) {
        console.error('Error during google login sync:', err);
        res.status(500).json({ message: 'Error while syncing user profile', error: err.message });
    }
});

module.exports = router;
