import express from 'express';
import {
  sendVerificationCode,
  loginOrRegister,
  refreshToken,
  getProfile,
  updateProfile,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post('/send-code', sendVerificationCode);
router.post('/login', loginOrRegister);
router.post('/refresh', refreshToken);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

export default router;
