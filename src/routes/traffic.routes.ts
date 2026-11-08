import { Router } from 'express';
import {
    getIntersections,
    receiveSensorData,
    manualOverride,
    getSystemLogs,
} from '../controllers/traffic.controller';

const router = Router();

router.get('/intersections', getIntersections);
router.post('/sensor', receiveSensorData);
router.post('/override', manualOverride);
router.get('/logs', getSystemLogs);

export default router;