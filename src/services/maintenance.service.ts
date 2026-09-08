import { findActiveLease } from '../repositories/lease.repository';
import { findPropertyById } from '../repositories/property.repository';
import { findUserById } from '../repositories/user.repository';
import {
  countPendingRequestsForLandlord,
  createComment,
  createMaintenanceRequest,
  findMaintenanceRequestById,
  listCommentsForRequest,
  listMaintenanceRequestsForLandlord,
  listMaintenanceRequestsForTenant,
  MaintenanceCommentWithAuthor,
  MaintenanceRequestRecord,
  MaintenanceRequestWithPropertyRecord,
  MaintenanceSeverity,
  MaintenanceStatus,
  updateMaintenanceRequestSeverity,
  updateMaintenanceRequestStatus,
} from '../repositories/maintenance.repository';
import { createInAppNotification, notifyMaintenanceReported, notifyMaintenanceStatusUpdated } from './notification.service';
import { logAction } from './audit.service';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { RequestContext } from '../types';

export async function reportIssue(
  params: {
    tenantId: string;
    propertyId: string;
    issueType: string;
    description: string;
    severity: MaintenanceSeverity;
    photoPath: string | null;
    photoMimeType: string | null;
  },
  context: RequestContext = {}
): Promise<MaintenanceRequestRecord> {
  const lease = await findActiveLease(params.propertyId, params.tenantId);
  if (!lease) {
    throw new ForbiddenError('You are not assigned to this property');
  }

  const request = await createMaintenanceRequest({
    propertyId: params.propertyId,
    leaseId: lease.id,
    reportedBy: params.tenantId,
    issueType: params.issueType,
    description: params.description,
    severity: params.severity,
    photoPath: params.photoPath,
    photoMimeType: params.photoMimeType,
  });

  await logAction({
    userId: params.tenantId,
    action: 'maintenance.reported',
    resourceType: 'maintenance_request',
    resourceId: request.id,
    metadata: { propertyId: params.propertyId, severity: params.severity },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  const property = await findPropertyById(params.propertyId);
  if (property) {
    const [tenant, landlord] = await Promise.all([findUserById(params.tenantId), findUserById(property.ownerId)]);
    if (tenant && landlord) {
      await notifyMaintenanceReported({
        landlordEmail: landlord.email,
        propertyAddress: property.address,
        issueType: params.issueType,
        severity: params.severity,
        tenantName: tenant.name,
      });

      await createInAppNotification({
        userId: landlord.id,
        type: 'maintenance_reported',
        title: 'Nouveau signalement',
        body: `${tenant.name} a signalé un problème (${params.issueType}) pour ${property.address}.`,
        propertyId: property.id,
      });
    }
  }

  return request;
}

export async function listMyRequests(tenantId: string): Promise<MaintenanceRequestRecord[]> {
  return listMaintenanceRequestsForTenant(tenantId);
}

export async function listRequestsForLandlord(landlordId: string): Promise<MaintenanceRequestWithPropertyRecord[]> {
  return listMaintenanceRequestsForLandlord(landlordId);
}

export async function updateStatus(
  params: { requestId: string; landlordId: string; status: MaintenanceStatus },
  context: RequestContext = {}
): Promise<MaintenanceRequestRecord> {
  const request = await findMaintenanceRequestById(params.requestId);
  if (!request) {
    throw new NotFoundError('Maintenance request not found');
  }

  const property = await findPropertyById(request.propertyId);
  if (!property || property.ownerId !== params.landlordId) {
    throw new ForbiddenError('You do not have permission to manage this request');
  }

  const updated = await updateMaintenanceRequestStatus(params.requestId, params.status);

  await logAction({
    userId: params.landlordId,
    action: 'maintenance.status_updated',
    resourceType: 'maintenance_request',
    resourceId: request.id,
    metadata: { status: params.status },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  if (params.status === 'resolved') {
    const tenant = await findUserById(request.reportedBy);
    if (tenant) {
      await notifyMaintenanceStatusUpdated({
        tenantEmail: tenant.email,
        propertyAddress: property.address,
        issueType: request.issueType,
        status: params.status,
      });
    }
  }

  return updated;
}

export async function countPendingForLandlord(landlordId: string): Promise<number> {
  return countPendingRequestsForLandlord(landlordId);
}

export async function updateSeverity(
  params: { requestId: string; landlordId: string; severity: MaintenanceSeverity },
  context: RequestContext = {}
): Promise<MaintenanceRequestRecord> {
  const request = await findMaintenanceRequestById(params.requestId);
  if (!request) {
    throw new NotFoundError('Maintenance request not found');
  }

  const property = await findPropertyById(request.propertyId);
  if (!property || property.ownerId !== params.landlordId) {
    throw new ForbiddenError('You do not have permission to manage this request');
  }

  const updated = await updateMaintenanceRequestSeverity(params.requestId, params.severity);

  await logAction({
    userId: params.landlordId,
    action: 'maintenance.severity_updated',
    resourceType: 'maintenance_request',
    resourceId: request.id,
    metadata: { from: request.severity, to: params.severity },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return updated;
}

async function assertCanAccessRequest(params: {
  requestId: string;
  userId: string;
  role: string;
}): Promise<MaintenanceRequestRecord> {
  const request = await findMaintenanceRequestById(params.requestId);
  if (!request) {
    throw new NotFoundError('Maintenance request not found');
  }

  const isReporter = request.reportedBy === params.userId;
  let isLandlord = false;
  if (params.role === 'landlord') {
    const property = await findPropertyById(request.propertyId);
    isLandlord = property?.ownerId === params.userId;
  }

  if (!isReporter && !isLandlord) {
    throw new ForbiddenError('You do not have permission to view this request');
  }

  return request;
}

export async function listComments(params: {
  requestId: string;
  userId: string;
  role: string;
}): Promise<MaintenanceCommentWithAuthor[]> {
  await assertCanAccessRequest(params);
  return listCommentsForRequest(params.requestId);
}

export async function addComment(params: {
  requestId: string;
  userId: string;
  role: string;
  body: string;
}): Promise<MaintenanceCommentWithAuthor[]> {
  const request = await assertCanAccessRequest(params);

  await createComment({ requestId: request.id, authorId: params.userId, body: params.body });

  return listCommentsForRequest(request.id);
}

export async function getPhotoPath(params: {
  requestId: string;
  requesterId: string;
  requesterRole: string;
}): Promise<{ path: string; mimeType: string }> {
  const request = await findMaintenanceRequestById(params.requestId);
  if (!request || !request.photoPath || !request.photoMimeType) {
    throw new NotFoundError('No photo attached to this request');
  }

  const isReporter = request.reportedBy === params.requesterId;
  let isLandlord = false;
  if (params.requesterRole === 'landlord') {
    const property = await findPropertyById(request.propertyId);
    isLandlord = property?.ownerId === params.requesterId;
  }

  if (!isReporter && !isLandlord) {
    throw new ForbiddenError('You do not have permission to view this photo');
  }

  return { path: request.photoPath, mimeType: request.photoMimeType };
}
