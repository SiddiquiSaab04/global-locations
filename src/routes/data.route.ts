import { Router } from 'express';
import { ingestData } from '../controllers/data.controller';

const router = Router();

router.post('/fetch-data', ingestData);

export default router;