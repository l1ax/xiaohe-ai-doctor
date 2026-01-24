import { Request, Response } from 'express';
import multer from 'multer';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errorHandler';
import { storageService } from '../services/storage/storageService';

/**
 * 配置 multer 用于内存存储
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only image files are allowed'));
    }
  },
});

/**
 * 上传图片
 * POST /api/upload/image
 */
export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    // 检查存储服务是否可用
    if (!storageService.isAvailable()) {
      throw new ValidationError('Storage service not available');
    }

    // 生成文件名
    const fileName = `${Date.now()}_${req.user.userId}_${req.file.originalname}`;
    const path = `uploads/${req.user.userId}`;

    // 上传到 Supabase Storage
    const result = await storageService.uploadFile(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      path
    );

    logger.info('Image uploaded', {
      userId: req.user.userId,
      path: result.path,
      fileSize: req.file.size,
      contentType: req.file.mimetype,
    });

    res.json({
      code: 0,
      data: {
        url: result.url,
        path: result.path,
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Upload image error', error);
    throw error;
  }
};

// 导出中间件
export const uploadMiddleware = upload.single('file');
