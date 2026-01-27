import React, { useState, useRef } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { userStore } from '../../store/userStore';

interface ImageUploaderProps {
  onImageUploaded: (url: string) => void;
  disabled?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUploaded,
  disabled = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('仅支持 JPG、PNG、GIF、WebP 格式');
      return;
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      toast.error('图片不能超过 5MB');
      return;
    }

    setUploading(true);
    
    try {
      const imageUrl = await uploadImage(file);
      onImageUploaded(imageUrl);
      toast.success('图片上传成功');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('图片上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = userStore.accessToken;
    if (!token) {
      throw new Error('未登录，请先登录');
    }

    abortControllerRef.current = new AbortController();

    const response = await fetch(`${API_BASE_URL}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.message || 'Upload failed');
    }

    return result.data.url;
  };

  const handleClick = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
        aria-label="上传图片"
      />
      
      <button
        onClick={handleClick}
        disabled={disabled || uploading}
        aria-label="选择图片"
        className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <ImageIcon className="w-6 h-6" />
        )}
      </button>
    </>
  );
};
