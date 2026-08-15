import express from 'express';
import * as messageService from '../services/message.service';

export async function listConversationsHandler(req: express.Request, res: express.Response): Promise<void> {
  const conversations = await messageService.listMyConversations(req.user!.userId, req.user!.role);
  res.status(200).json({ success: true, data: conversations, timestamp: new Date() });
}

export async function unreadCountHandler(req: express.Request, res: express.Response): Promise<void> {
  const count = await messageService.getTotalUnreadCount(req.user!.userId, req.user!.role);
  res.status(200).json({ success: true, data: { count }, timestamp: new Date() });
}
