const admin = require('firebase-admin');
// const serviceAccount = require('./serviceAccountKey.json'); // TODO: Add your serviceAccountKey.json file here

// Initialize Firebase Admin SDK
// You should replace the credential with your service account key
// or ensure the environment has GOOGLE_APPLICATION_CREDENTIALS set.
// For now, we'll try to use application default credentials or a placeholder.

if (!admin.apps.length) {
  try {
    // Check if serviceAccountKey.json exists (you would need to add this file manually)
    const serviceAccount = require('./email-management-app-c49c1-firebase-adminsdk-fbsvc-d09dc804a4.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin initialized with service account.");
  } catch (e) {
    console.log("Service account key not found or invalid, attempting to use default credentials.", e.message);
    // Fallback or instructions
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
    });
  }
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
