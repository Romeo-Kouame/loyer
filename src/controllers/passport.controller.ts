import express from 'express';
import * as passportService from '../services/passport.service';

export async function getPublicPassportHandler(req: express.Request, res: express.Response): Promise<void> {
  const passport = await passportService.getPublicPassport(req.params.token);
  res.status(200).json({ success: true, data: passport, timestamp: new Date() });
}
