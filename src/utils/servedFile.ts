import express from 'express';

// `path` is either a local filesystem path (dev / non-Blob deploys) or a
// public Blob URL (see middleware/upload.ts). Access control already
// happened in the caller before this runs.
export function sendStoredFile(res: express.Response, path: string, mimeType: string): void {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    res.redirect(path);
    return;
  }

  res.setHeader('Content-Type', mimeType);
  res.sendFile(path);
}
