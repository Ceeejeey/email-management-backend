const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { db } = require('../config/firebase');
const authenticateToken = require('../middlewares/authMiddleware');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

router.post('/send-email', authenticateToken, async (req, res) => {
  const { subject, body, recipients } = req.body;
  const userId = req.userId;

  if (!subject || !body || !recipients || recipients.length === 0) {
    return res.status(400).json({ message: 'Subject, body, and recipients are required.' });
  }

  try {
    // Fetch authenticated user's Google tokens from Firestore
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists || !userDoc.data().googleTokens) {
      return res.status(401).json({ message: 'Google account not connected.' });
    }

    const googleTokens = JSON.parse(userDoc.data().googleTokens);

    // Set credentials for OAuth2 Client
    oauth2Client.setCredentials({
      access_token: googleTokens.access_token,
      refresh_token: googleTokens.refresh_token,
    });

    // Refresh the access token if needed
    const { token } = await oauth2Client.getAccessToken();

    // 🔹 Ensure recipients are joined correctly with commas
    const recipientList = recipients.map((email) => `<${email}>`).join(', ');

    // 🔹 Construct properly formatted email content
    const emailContent = [
      `To: ${recipientList}`, // Correct email format
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body
    ].join('\r\n');

    // Encode the message for Gmail API
    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    // Send email using Gmail API
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Failed to send email.', error: error.message });
  }
});


module.exports = router;
