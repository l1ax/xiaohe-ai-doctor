import express from 'express';
import rateLimit from 'express-rate-limit';
import { uploadImage, uploadMiddleware } from '../controllers/uploadController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Rate limiting middleware for upload endpoint
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many upload requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 上传图片
 * POST /api/upload/image
 */
router.post('/image', authMiddleware, uploadRateLimit, uploadMiddleware, uploadImage);

export default router;
