import path from 'path';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import { config } from './config';
import apiRoutes from './routes';

const app = express();

app.use(cors());
app.use(express.json());

// API routes.
app.use('/api', apiRoutes);

// Serve the frontend from /public.
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Root serves the login page.
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
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
});
