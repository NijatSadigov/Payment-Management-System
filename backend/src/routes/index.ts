import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import authRoutes from './auth';
import managerRoutes from './managers';
import campaignRoutes from './campaigns';
import customerRoutes from './customers';
import statsRoutes from './stats';
import exportRoutes from './export';
import epayRoutes from './epay';
import payRoutes from './pay';

const router = Router();

router.use('/auth', authRoutes);
// EPAY gateway callbacks are public (signature-verified), not user-authenticated.
router.use('/epay', epayRoutes);
// Customer self-service payment portal is public (tokenized links).
router.use('/pay', payRoutes);

// Everything below requires a valid token.
router.use(authenticate);
router.use('/managers', managerRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/customers', customerRoutes);
router.use('/stats', statsRoutes);
router.use('/export', exportRoutes);

// Convenience endpoint for the frontend to fetch the current user.
router.get('/me', (req, res) => res.json(req.user));

export default router;
