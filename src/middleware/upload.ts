import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import express from 'express';
import multer from 'multer';
import { put } from '@vercel/blob';
import { ValidationError } from '../utils/errors';

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

// Vercel's filesystem is read-only/ephemeral per invocation, so local disk
// storage only works for local dev and a persistent server. When a Blob
// token is configured (set automatically once the Blob store is linked to
// the Vercel project) uploads go to Blob storage instead - same code path
// either way, callers just read `req.file.path` as before.
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function diskStorageFor(subdir: string) {
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

// Runs after multer. In Blob mode the file only exists in memory (`file.buffer`)
// at this point - push it to Blob storage and rewrite `file.path` to the
// resulting public URL so every downstream controller/service can keep
// treating `req.file.path` as "wherever this file lives" without knowing which
// backend is in use.
function finalizeUpload(subdir: string): express.RequestHandler {
  return (req, res, next) => {
    if (!USE_BLOB || !req.file) {
      next();
      return;
    }

    const ext = path.extname(req.file.originalname).slice(0, 10);
    const key = `${subdir}/${randomUUID()}${ext}`;

    put(key, req.file.buffer, { access: 'public', contentType: req.file.mimetype })
      .then((blob) => {
        req.file!.path = blob.url;
        next();
      })
      .catch(next);
  };
}

function buildUploader(subdir: string, fieldName: string): express.RequestHandler[] {
  const storage = USE_BLOB ? multer.memoryStorage() : diskStorageFor(subdir);
  const uploader = wrapSingleUpload(
    multer({ storage, limits: { fileSize: MAX_FILE_SIZE_BYTES }, fileFilter }).single(fieldName)
  );
  return [uploader, finalizeUpload(subdir)];
}

export const uploadKycDocument = buildUploader('kyc', 'document');
export const uploadPropertyVerificationDocument = buildUploader('properties', 'document');
export const uploadMaintenancePhoto = buildUploader('maintenance', 'photo');
export const uploadProfilePicture = buildUploader('avatars', 'photo');
