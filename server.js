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

// Trust Traefik/Coolify reverse proxy — required for rate-limiter & correct IP detection
app.set('trust proxy', 1);

// Security & middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "cdn.jsdelivr.net"],
      workerSrc: ["'self'", "blob:"],
    },
  },
}));
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no Origin header) and configured origins
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    // Fallback: allow any .iraady.com or .kimuse.rw subdomain
    if (/\.iraady\.com$/.test(origin) || /\.kimuse\.rw$/.test(origin) ||
        origin === 'https://aceas.iraady.com') {
      return callback(null, origin);
    }
    return callback(null, origin); // allow all for now, but reflect origin not '*'
  },
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

app.get('/', serveHtml('landing.html'));
app.get('/landing', serveHtml('landing.html'));
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


// One-time seed endpoint for demo users - promotes user to given role
// Only works if SETUP_SECRET env var matches
app.post('/api/setup/promote', async (req, res) => {
  const { pool: dbPool } = require('./config/db');
  try {
    const secret = process.env.SETUP_SECRET || 'aceas-setup-2024';
    if (req.headers['x-setup-secret'] !== secret) {
      return res.status(403).json({ error: 'Invalid setup secret' });
    }
    const { email, role } = req.body;
    const validRoles = ['ai_developer', 'compliance_officer', 'system_admin'];
    if (!email || !role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'email and valid role required' });
    }
    const result = await dbPool.query(
      'UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, role',
      [role, email]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User role updated', user: result.rows[0] });
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
