// Usage:
// Defines the HTTP auth endpoints and delegates validation/business logic to the
// schema and service layers.

import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { login, register } from './auth.service.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await register(input);

    res.status(201).json(result);
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await login(input);

    res.status(200).json(result);
  })
);
