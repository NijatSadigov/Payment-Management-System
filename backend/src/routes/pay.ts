import { Router } from 'express';
import { getPublicCustomer, initPublicEpay } from '../controllers/publicPayController';

// Public customer self-service payment portal (tokenized, no auth).
const router = Router();

router.get('/:token', getPublicCustomer);
router.post('/:token/epay', initPublicEpay);

export default router;
