import express from 'express';
import { uploadImage, uploadMiddleware } from '../controllers/uploadController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * 上传图片
 * POST /api/upload/image
 */
router.post('/image', authMiddleware, uploadMiddleware, uploadImage);

export default router;
