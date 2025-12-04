const express = require('express');
const router = express.Router();
const multer = require('multer');
const { db } = require('../config/firebase');
const authenticateToken = require('../middlewares/authMiddleware');

// Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Fetch all templates
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('templates')
        .where('userId', '==', req.userId)
        .get();
    
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(templates);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ message: 'Error fetching templates' });
  }
});

// Create a new template
router.post('/templates', authenticateToken, upload.single('file'), async (req, res) => {
  const { name, content } = req.body;

  try {
    const docRef = await db.collection('templates').add({
      name,
      content,
      userId: req.userId,
      createdAt: new Date().toISOString()
    });
    res.json({ id: docRef.id, name, content });
  } catch (err) {
    console.error('Error saving template:', err);
    res.status(500).json({ message: 'Error saving template' });
  }
});

// Update a template
router.put('/templates/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, content } = req.body;

  try {
    const templateRef = db.collection('templates').doc(id);
    const doc = await templateRef.get();
    
    if (!doc.exists || doc.data().userId !== req.userId) {
        return res.status(404).json({ message: 'Template not found or unauthorized' });
    }

    await templateRef.update({ name, content });
    res.json({ id, name, content });
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ message: 'Error updating template' });
  }
});

// Delete a template
router.delete('/templates/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const templateRef = db.collection('templates').doc(id);
    const doc = await templateRef.get();
    
    if (!doc.exists || doc.data().userId !== req.userId) {
        return res.status(404).json({ message: 'Template not found or unauthorized' });
    }

    await templateRef.delete();
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ message: 'Error deleting template' });
  }
});

module.exports = router;
