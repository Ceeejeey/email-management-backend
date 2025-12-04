const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authenticateToken = require('../middlewares/authMiddleware');

// 1. Create a New Group
router.post('/groups', authenticateToken, async (req, res) => {
  const { name, description } = req.body;

  if (!name) return res.status(400).json({ message: 'Group name is required' });

  try {
    const groupRef = await db.collection('groups').add({
      name,
      description,
      userId: req.userId,
      createdAt: new Date().toISOString()
    });
    res.status(201).json({ id: groupRef.id, name, description });
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ message: 'Error creating group' });
  }
});

// 2. Add Contacts to a Group
router.post('/groups/:groupId/contacts', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const { contactIds } = req.body;

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ message: 'Invalid or empty contact list' });
  }

  try {
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().userId !== req.userId) {
        return res.status(404).json({ message: 'Group not found or unauthorized' });
    }

    const batch = db.batch();
    contactIds.forEach(contactId => {
        const contactRef = groupRef.collection('contacts').doc(contactId);
        batch.set(contactRef, { addedAt: new Date().toISOString() });
    });

    await batch.commit();
    res.json({ message: 'Contacts added successfully' });
  } catch (err) {
    console.error('Error adding contacts to group:', err);
    res.status(500).json({ message: 'Error adding contacts to group' });
  }
});

// 3. Remove Contacts from a Group
router.delete('/groups/:groupId/contacts', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const { contactIds } = req.body;

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ message: 'Invalid or empty contact list to remove' });
  }

  try {
    const groupRef = db.collection('groups').doc(groupId);
    const batch = db.batch();

    contactIds.forEach(contactId => {
        const contactRef = groupRef.collection('contacts').doc(contactId);
        batch.delete(contactRef);
    });

    await batch.commit();
    res.json({ message: 'Contacts removed successfully' });
  } catch (err) {
    console.error('Error removing contacts from group:', err);
    res.status(500).json({ message: 'Error removing contacts from group' });
  }
});

// 4. Fetch Group Details with Contacts
router.get('/groups/:groupId', authenticateToken, async (req, res) => {
  const { groupId } = req.params;

  try {
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists || groupDoc.data().userId !== req.userId) {
        return res.status(404).json({ message: 'Group not found' });
    }

    const groupData = groupDoc.data();
    const contactsSnapshot = await groupRef.collection('contacts').get();
    
    const contactIds = contactsSnapshot.docs.map(doc => doc.id);
    
    let contacts = [];
    if (contactIds.length > 0) {
        const contactRefs = contactIds.map(id => db.collection('contacts').doc(id));
        const contactDocs = await db.getAll(...contactRefs);
        contacts = contactDocs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    res.json({ id: groupDoc.id, ...groupData, contacts });
  } catch (err) {
    console.error('Error fetching group details:', err);
    res.status(500).json({ message: 'Error fetching group details' });
  }
});

// 5. Update Group Details
router.put('/groups/:groupId', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const { name, description, contactIds } = req.body;

  if (!name) return res.status(400).json({ message: 'Group name is required' });

  try {
    const groupRef = db.collection('groups').doc(groupId);
    
    await groupRef.update({ name, description });

    if (Array.isArray(contactIds)) {
        const currentContactsSnapshot = await groupRef.collection('contacts').get();
        const currentContactIds = currentContactsSnapshot.docs.map(doc => doc.id);
        
        const toAdd = contactIds.filter(id => !currentContactIds.includes(id));
        const toRemove = currentContactIds.filter(id => !contactIds.includes(id));
        
        const batch = db.batch();
        
        toAdd.forEach(id => {
            batch.set(groupRef.collection('contacts').doc(id), { addedAt: new Date().toISOString() });
        });
        
        toRemove.forEach(id => {
            batch.delete(groupRef.collection('contacts').doc(id));
        });
        
        await batch.commit();
    }

    res.json({ message: 'Group updated successfully' });
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ message: 'Error updating group' });
  }
});

// 6. Delete a Group
router.delete('/groups/:groupId', authenticateToken, async (req, res) => {
  const { groupId } = req.params;

  try {
    const groupRef = db.collection('groups').doc(groupId);
    
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists || groupDoc.data().userId !== req.userId) {
        return res.status(404).json({ message: 'Group not found' });
    }

    const contactsSnapshot = await groupRef.collection('contacts').get();
    const batch = db.batch();
    contactsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(groupRef);
    
    await batch.commit();
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error('Error deleting group:', err);
    res.status(500).json({ message: 'Error deleting group' });
  }
});

// 7. Fetch Contacts of a Group
router.get('/groups/:groupId/contacts', authenticateToken, async (req, res) => {
    const { groupId } = req.params;
    try {
        const groupRef = db.collection('groups').doc(groupId);
        const contactsSnapshot = await groupRef.collection('contacts').get();
        const contactIds = contactsSnapshot.docs.map(doc => doc.id);
        
        if (contactIds.length === 0) return res.json([]);
        
        const contactRefs = contactIds.map(id => db.collection('contacts').doc(id));
        const contactDocs = await db.getAll(...contactRefs);
        const contacts = contactDocs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        res.json(contacts);
    } catch (err) {
        console.error('Error fetching contacts for group:', err);
        res.status(500).json({ message: 'Error fetching contacts for group' });
    }
});

// 8. Fetch All Groups
router.get('/groups', authenticateToken, async (req, res) => {
  try {
    const groupsSnapshot = await db.collection('groups')
        .where('userId', '==', req.userId)
        .get();

    const groups = [];
    for (const doc of groupsSnapshot.docs) {
        const groupData = doc.data();
        const contactsSnapshot = await doc.ref.collection('contacts').get();
        const contactIds = contactsSnapshot.docs.map(d => d.id);
        
        let contacts = [];
        if (contactIds.length > 0) {
             const contactRefs = contactIds.map(id => db.collection('contacts').doc(id));
             const contactDocs = await db.getAll(...contactRefs);
             contacts = contactDocs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        groups.push({ id: doc.id, ...groupData, contacts });
    }

    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ message: 'Error fetching groups' });
  }
});

module.exports = router;
