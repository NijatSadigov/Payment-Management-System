import path from 'path';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import { config, checkProductionConfig } from './config';
import apiRoutes from './routes';
import { backfillCustomerCodes } from './lib/customerCode';

checkProductionConfig();

const app = express();

// On the host (cPanel/Passenger) requests arrive through a reverse proxy; trust
// it so req.ip is the visitor's address (used by the wrong-code rate limit).
if (config.isProduction) app.set('trust proxy', 1);

// Private tool: keep every page and API response out of search engines.
app.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.use(cors());
app.use(express.json());

// API routes.
app.use('/api', apiRoutes);

// Serve the frontend from /public. The staff login page is only served at its
// private path, never as a static file.
const publicDir = path.join(__dirname, '..', 'public');
app.use('/login.html', (_req, res) => res.status(404).end());
app.use(express.static(publicDir, { index: false }));

// Staff login.
app.get(config.adminPath, (_req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

// Earlier customer links lived under /p.
app.get('/p', (_req, res) => res.redirect(301, '/'));
app.get('/p/:code', (req, res) => res.redirect(301, '/' + encodeURIComponent(req.params.code)));

// Customer portal: / asks for a customer code, /<code> (e.g. /Sadigov-NS4K7QX)
// shows that customer's payments. Both are pay.html.
app.get(['/', '/:code([A-Za-z0-9][A-Za-z0-9-]{2,60})'], (_req, res) => {
  res.sendFile(path.join(publicDir, 'pay.html'));
});

// Central error handler so thrown errors return JSON, not HTML.
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  },
);

app.listen(config.port, () => {
  console.log(`Payment Management System running at http://localhost:${config.port}`);
  backfillCustomerCodes().catch((err) => console.error('Customer code backfill failed', err));
});
