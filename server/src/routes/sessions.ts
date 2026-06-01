import express from 'express';
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  getSessionStats
} from '../controllers/sessions';

const router = express.Router();

// Routes
router.get('/', getSessions);
router.post('/', createSession);
router.put('/:id', updateSession);
router.delete('/:id', deleteSession);
router.get('/stats', getSessionStats);

export default router;