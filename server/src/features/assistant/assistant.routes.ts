import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { asyncHandler } from '../../shared/async-handler.js';
import type { AuthenticatedRequest } from '../../shared/authenticated-request.js';
import { askAssistantSchema } from './assistant.schemas.js';
import { askAssistant } from './assistant.service.js';

export const assistantRouter = Router();

assistantRouter.post(
  '/assistant/ask',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const input = askAssistantSchema.parse(req.body);
    const orgSlugHeader = req.header('x-tixora-org-slug')?.trim();

    const result = await askAssistant({
      userId: authReq.user.id,
      orgSlug: orgSlugHeader || undefined,
      input
    });

    res.status(200).json(result);
  })
);
