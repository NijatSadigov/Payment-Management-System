import { Router } from 'express';
import { exportExcel, exportPdf } from '../controllers/exportController';

const router = Router();

router.get('/excel', exportExcel);
router.get('/pdf', exportPdf);

export default router;
