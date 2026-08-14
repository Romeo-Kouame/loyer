import express from 'express';
import * as authService from '../services/auth.service';
import { RequestContext } from '../types';

function contextFrom(req: express.Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.header('user-agent') };
}

export async function registerHandler(req: express.Request, res: express.Response): Promise<void> {
  const result = await authService.register(req.body, contextFrom(req));
  res.status(201).json({ success: true, data: result, timestamp: new Date() });
}

export async function loginHandler(req: express.Request, res: express.Response): Promise<void> {
  const { email, password } = req.body;
  const result = await authService.login(email, password, contextFrom(req));
  res.status(200).json({ success: true, data: result, timestamp: new Date() });
}

export async function refreshHandler(req: express.Request, res: express.Response): Promise<void> {
  const { refreshToken } = req.body;
  const tokens = await authService.refresh(refreshToken);
  res.status(200).json({ success: true, data: tokens, timestamp: new Date() });
}

export async function meHandler(req: express.Request, res: express.Response): Promise<void> {
  const user = await authService.getCurrentUser(req.user!.userId);
  res.status(200).json({ success: true, data: user, timestamp: new Date() });
}
