const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Frontend development origins
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Submissions filepath
const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.json');

// Ensure submissions file exists
if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// Nodemailer Transporter Setup
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return null;
};

// Route: Contact form submission
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Simple validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required (name, email, subject, message).'
    });
  }

  const newSubmission = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name,
    email,
    subject,
    message,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Save submission to local submissions.json file
    const fileData = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    const submissions = JSON.parse(fileData);
    submissions.push(newSubmission);
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
    console.log(`[Database] Saved message from ${name} (${email})`);

    // 2. Send email notification (if configured)
    const transporter = createTransporter();
    if (transporter) {
      const mailOptions = {
        from: `"${name}" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_TO || process.env.SMTP_USER,
        replyTo: email,
        subject: `Portfolio: ${subject}`,
        text: `You have received a new contact message from your portfolio.\n\n` +
              `Name: ${name}\n` +
              `Email: ${email}\n` +
              `Subject: ${subject}\n\n` +
              `Message:\n${message}`
      };

      await transporter.sendMail(mailOptions);
      console.log(`[Email] Notification email successfully sent to ${mailOptions.to}`);
    } else {
      console.log(`[Email Mock] SMTP not configured. Logged Message details:`);
      console.log(`- From: ${name} <${email}>`);
      console.log(`- Subject: ${subject}`);
      console.log(`- Content: ${message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you for your message! It has been successfully received.'
    });

  } catch (error) {
    console.error('[Error] Failed to process contact submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. We could not save your message at this time. Please email ujjawaldixit06@gmail.com directly.'
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] Express server running on port ${PORT}`);
});
