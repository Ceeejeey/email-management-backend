const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase'); 
const authenticateToken = require('../middlewares/authMiddleware');

// Add a new contact
router.post('/contacts', authenticateToken, async (req, res) => {
  const { name, email } = req.body;

  try {
    const docRef = await db.collection('contacts').add({
        name,
        email,
        userId: req.userId,
        createdAt: new Date().toISOString()
    });

    res.status(201).json({ id: docRef.id, name, email });
  } catch (err) {
    console.error('Error adding contact:', err);
    res.status(400).json({ message: 'Error adding contact' });
  }
});

// Delete a contact
router.delete('/contacts/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const contactRef = db.collection('contacts').doc(id);
    const doc = await contactRef.get();

    if (!doc.exists || doc.data().userId !== req.userId) {
        return res.status(404).json({ message: 'Contact not found or unauthorized' });
    }

    await contactRef.delete();
    res.json({ message: 'Contact deleted successfully' });
  } catch (err) {
    console.error('Error deleting contact:', err);
    res.status(400).json({ message: 'Error deleting contact' });
  }
});

// Update a contact
router.post('/update-contact/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  try {
    const contactRef = db.collection('contacts').doc(id);
    const doc = await contactRef.get();

    if (!doc.exists || doc.data().userId !== req.userId) {
        return res.status(404).json({ message: 'Contact not found or unauthorized' });
    }

    await contactRef.update({ name, email });
    res.json({ message: 'Contact updated successfully', id, name, email });
  } catch (err) {
    console.error('Error updating contact:', err);
    res.status(400).json({ message: 'Error updating contact' });
  }
});

// Fetch all contacts for the authenticated user
router.get('/contacts', authenticateToken, async (req, res) => {
  console.log('Fetching contacts for User ID:', req.userId);

  try {
    const snapshot = await db.collection('contacts')
        .where('userId', '==', req.userId)
        .get();

    const contacts = [];
    snapshot.forEach(doc => {
        contacts.push({ id: doc.id, ...doc.data() });
    });

    res.json(contacts);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(400).json({ message: 'Error fetching contacts' });
  }
});

module.exports = router;
