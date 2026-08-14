import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import express from 'express';
import multer from 'multer';
import { ValidationError } from '../utils/errors';

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

function storageFor(subdir: string) {
  const dir = path.join(UPLOADS_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: dir,
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).slice(0, 10);
      callback(null, `${randomUUID()}${ext}`);
    },
  });
}

function fileFilter(_req: unknown, file: Express.Multer.File, callback: multer.FileFilterCallback) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(new ValidationError('Only JPEG, PNG, or PDF documents are accepted'));
    return;
  }
  callback(null, true);
}

function wrapSingleUpload(uploader: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    uploader(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError) {
        next(new ValidationError(`Upload failed: ${err.message}`));
        return;
      }
      next(err);
    });
  };
}

export const uploadKycDocument = wrapSingleUpload(
  multer({ storage: storageFor('kyc'), limits: { fileSize: MAX_FILE_SIZE_BYTES }, fileFilter }).single('document')
);

export const uploadPropertyVerificationDocument = wrapSingleUpload(
  multer({ storage: storageFor('properties'), limits: { fileSize: MAX_FILE_SIZE_BYTES }, fileFilter }).single(
    'document'
  )
);
