const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
if (!process.env.VERCEL) require('dotenv').config({ path: path.join(__dirname, '.env') });
// Derive an app-specific signing key from the connected server-only Supabase secret.
if (!process.env.JWT_SECRET && process.env.SUPABASE_JWT_SECRET) {
  process.env.JWT_SECRET = require('node:crypto').createHmac('sha256', process.env.SUPABASE_JWT_SECRET)
    .update('expense-tracker-prantor:authentication:v1').digest('hex');
}
if (process.env.VERCEL && !process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');

const app = express();
const allowedOriginPatterns = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+:\d+$/,
];
const configuredOrigins = (process.env.CORS_ORIGIN || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(morgan('combined'));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', require('./config/database').middleware);

app.get('/api/health', (req, res) => res.json({ status: 'OK', ts: new Date().toISOString() }));

// ── Core routes ──────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/categories',   require('./routes/categories'));
app.use('/api/accounts',     require('./routes/accounts'));

// ── Extended user-data routes (all server-side, no more localStorage) ────────
app.use('/api/loans',            require('./routes/loans'));
app.use('/api/goals',            require('./routes/goals'));
app.use('/api/financial-users',  require('./routes/financialUsers'));
app.use('/api/settings',         require('./routes/settings'));
app.use('/api/additional-info',  require('./routes/additionalInfo'));
app.use('/api/vouchers',         require('./routes/vouchers'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.use('*', (req,res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.API_PORT || 3001;
const HOST = process.env.API_HOST || '0.0.0.0';
if (require.main === module) {
  app.listen(PORT, HOST, () => console.log(`API listening on http://${HOST}:${PORT}`));
}
module.exports = app;
