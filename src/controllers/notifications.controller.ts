import express from 'express';
import * as notificationService from '../services/notification.service';

export async function listHandler(req: express.Request, res: express.Response): Promise<void> {
  const notifications = await notificationService.listMyNotifications(req.user!.userId);
  res.status(200).json({
    success: true,
    data: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      propertyId: n.propertyId,
      isRead: n.readAt !== null,
      createdAt: n.createdAt,
    })),
    timestamp: new Date(),
  });
}

export async function unreadCountHandler(req: express.Request, res: express.Response): Promise<void> {
  const count = await notificationService.getUnreadNotificationCount(req.user!.userId);
  res.status(200).json({ success: true, data: { count }, timestamp: new Date() });
}

export async function markReadHandler(req: express.Request, res: express.Response): Promise<void> {
  await notificationService.markNotificationAsRead(req.params.id, req.user!.userId);
  res.status(204).send();
}

export async function markAllReadHandler(req: express.Request, res: express.Response): Promise<void> {
  await notificationService.markAllNotificationsAsRead(req.user!.userId);
  res.status(204).send();
}
