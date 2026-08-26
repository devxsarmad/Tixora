// Usage:
// Builds the Express app: security middleware, JSON parsing, routes, health
// check, and final error handling.

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { query } from './db/pool.js';
import { authRouter } from './features/auth/auth.routes.js';
import { commentRouter } from './features/comments/comment.routes.js';
import { projectRouter } from './features/projects/project.routes.js';
import { taskRouter } from './features/tasks/task.routes.js';
import { teamRouter } from './features/teams/team.routes.js';
import { userRouter } from './features/users/user.routes.js';
import { errorMiddleware } from './shared/error-middleware.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/health/db', async (_req, res, next) => {
    try {
      const result = await query<{ database_name: string; server_time: Date }>(
        `
          SELECT
            current_database() AS database_name,
            now() AS server_time
        `
      );

      res.status(200).json({
        status: 'ok',
        database: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api', commentRouter);
  app.use('/api', projectRouter);
  app.use('/api', taskRouter);
  app.use('/api/users', userRouter);
  app.use('/api/teams', teamRouter);
  app.use(errorMiddleware);

  return app;
}
