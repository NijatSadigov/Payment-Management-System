import { Router } from 'express';
import {
  getEpayOrder,
  epayCallback,
  epaySandboxComplete,
  epointCallback,
} from '../controllers/paymentController';

// Public online-payment endpoints. Called by the gateway (or the sandbox
// checkout page), NOT by an authenticated app user, so they are mounted BEFORE
// the auth middleware. Trust comes from the signed callback.
const router = Router();

router.get('/order/:ref', getEpayOrder);
router.post('/callback', epayCallback); // sandbox HMAC callback
router.post('/epoint-callback', epointCallback); // live Epoint result URL
router.post('/sandbox/complete', epaySandboxComplete);

export default router;
