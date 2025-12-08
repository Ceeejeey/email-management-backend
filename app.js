require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');

// DEBUG: Log the Google Redirect URI on startup
console.log('---------------------------------------------------');
console.log('SERVER STARTUP CONFIGURATION:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set');
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not Set');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('---------------------------------------------------');

// Initialize express app
const app = express();
app.set('trust proxy', 1); // Trust first proxy (Cloud Run / Load Balancer)
app.set('etag', false); // Disable ETags to prevent 304 Not Modified responses
const upload = multer({ dest: 'uploads/' });

// Middleware setup
app.use(
  cors({
    origin: [
      process.env.BASE_URL, 
      'http://localhost:3001', 
      'https://email-frontend-767837784755.asia-south1.run.app',
      'https://email-frontend-dvzkpvxfrq-as.a.run.app',
      'https://gihanvimukthi.dev'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.options('*', cors()); // Enable pre-flight for all routes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.get('/favicon.ico', (req, res) => res.status(204).end()); // Ignore favicon requests


// Use routes
app.use("/api", require("./controllers/authController"));
app.use("/api", require("./controllers/contactController"));
app.use("/api", require("./controllers/groupsController"));
app.use("/api", require("./templateRoutes/templateRoutes"));
app.use("/api", require("./controllers/sendEmailController"));
app.use("/api", require("./controllers/profileController"));


// Set the server to listen on a specific port
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
});
