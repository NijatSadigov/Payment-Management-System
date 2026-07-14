import { Router } from 'express';
import { overview, byCampaign, byManager, timeline } from '../controllers/statsController';

const router = Router();

router.get('/overview', overview);
router.get('/by-campaign', byCampaign);
router.get('/by-manager', byManager);
router.get('/timeline', timeline);

export default router;
