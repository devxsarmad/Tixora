// Usage:
// Starts the HTTP server. Keeping this separate from createApp makes testing the
// Express app easier later.

import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    void pool.end();
  });
});
