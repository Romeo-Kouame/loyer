import express from 'express';
import * as propertyService from '../services/property.service';

export async function createHandler(req: express.Request, res: express.Response): Promise<void> {
  const property = await propertyService.addProperty({
    ownerId: req.user!.userId,
    address: req.body.address,
    numberOfApartments: req.body.numberOfApartments,
  });

  res.status(201).json({ success: true, data: property, timestamp: new Date() });
}

export async function listHandler(req: express.Request, res: express.Response): Promise<void> {
  const properties = await propertyService.listMyProperties({
    userId: req.user!.userId,
    role: req.user!.role,
  });
  res.status(200).json({ success: true, data: properties, timestamp: new Date() });
}

export async function getHandler(req: express.Request, res: express.Response): Promise<void> {
  const property = await propertyService.getProperty({
    propertyId: req.params.id,
    userId: req.user!.userId,
    role: req.user!.role,
  });

  res.status(200).json({ success: true, data: property, timestamp: new Date() });
}
