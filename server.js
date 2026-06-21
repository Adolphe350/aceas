require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const { initializeDB } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const developerRoutes = require('./routes/developer.routes');
const officerRoutes = require('./routes/officer.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/developer', developerRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/admin', adminRoutes);

// Serve HTML pages
const serveHtml = (filePath) => (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', filePath));
};

app.get('/', (req, res) => res.redirect('/views/login.html'));
app.get('/login', serveHtml('login.html'));
app.get('/register', serveHtml('register.html'));
app.get('/verify-otp', serveHtml('verify-otp.html'));
app.get('/developer/dashboard', serveHtml('developer/dashboard.html'));
app.get('/developer/new-project', serveHtml('developer/new-project.html'));
app.get('/developer/questionnaire', serveHtml('developer/questionnaire.html'));
app.get('/developer/results', serveHtml('developer/results.html'));
app.get('/officer/dashboard', serveHtml('officer/dashboard.html'));
app.get('/admin/dashboard', serveHtml('admin/dashboard.html'));

// One-time setup endpoint - creates first admin if none exists
app.post('/api/setup', async (req, res) => {
  const { pool: dbPool } = require('./config/db');
  const bcryptLib = require('bcryptjs');
  try {
    const adminCheck = await dbPool.query("SELECT COUNT(*) FROM users WHERE role = 'system_admin'");
    if (parseInt(adminCheck.rows[0].count) > 0) {
      return res.status(403).json({ error: 'Setup already completed. Admin users exist.' });
    }
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email, and password required' });
    }
    const hash = await bcryptLib.hash(password, 12);
    const result = await dbPool.query(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'system_admin') RETURNING id, email, role",
      [full_name, email, hash]
    );
    res.json({ message: 'Admin user created successfully', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', 'views', 'login.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    await initializeDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 ACEAS server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
