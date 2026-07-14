import { Router } from 'express';
import {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  updateSchedule,
} from '../controllers/customerController';
import { listPayments, createPayment, initEpayPayment } from '../controllers/paymentController';

const router = Router();

router.get('/', listCustomers);
router.post('/', createCustomer);
router.get('/:id', getCustomer);
router.put('/:id', updateCustomer);
router.put('/:id/schedule', updateSchedule);

// Nested payment routes.
router.get('/:id/payments', listPayments);
router.post('/:id/payments', createPayment);
router.post('/:id/payments/epay', initEpayPayment);

export default router;
