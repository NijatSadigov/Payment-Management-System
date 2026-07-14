import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  assignManager,
} from '../controllers/campaignController';

const router = Router();

// Listing is available to both roles (managers see only their campaigns).
router.get('/', listCampaigns);

// Mutations are Super Admin only.
router.post('/', requireRole('super_admin'), createCampaign);
router.put('/:id', requireRole('super_admin'), updateCampaign);
router.delete('/:id', requireRole('super_admin'), deleteCampaign);
router.post('/:id/assign-manager', requireRole('super_admin'), assignManager);

export default router;
