import { Router } from 'express';
import { getPublicCustomer, initPublicEpay } from '../controllers/publicPayController';

// Public customer self-service payment portal, addressed by customer code (no auth).
const router = Router();

router.get('/:code', getPublicCustomer);
router.post('/:code/epay', initPublicEpay);

export default router;
