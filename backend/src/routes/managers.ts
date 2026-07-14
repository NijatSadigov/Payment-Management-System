import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import {
  listManagers,
  createManager,
  updateManager,
  deleteManager,
} from '../controllers/managerController';

const router = Router();

// Manager administration is Super Admin only.
router.use(requireRole('super_admin'));

router.get('/', listManagers);
router.post('/', createManager);
router.put('/:id', updateManager);
router.delete('/:id', deleteManager);

export default router;
