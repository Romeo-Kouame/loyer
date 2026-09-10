import {
  AdminUserDetail,
  getPlatformOverview,
  findUserDetailById,
  listAllUsers,
  PlatformOverview,
  PlatformUserSummary,
} from '../repositories/admin.repository';
import { findPropertiesByOwnerId, PropertyRecord } from '../repositories/property.repository';
import { findActivePropertiesForTenant, LeaseWithProperty } from '../repositories/lease.repository';
import { NotFoundError } from '../utils/errors';

export async function getOverview(): Promise<PlatformOverview> {
  return getPlatformOverview();
}

export async function listUsers(params: {
  role?: string;
  page: number;
  pageSize: number;
}): Promise<{ users: PlatformUserSummary[]; total: number; page: number; pageSize: number }> {
  const { users, total } = await listAllUsers({
    role: params.role,
    limit: params.pageSize,
    offset: (params.page - 1) * params.pageSize,
  });
  return { users, total, page: params.page, pageSize: params.pageSize };
}

export interface AdminUserDetailView {
  user: AdminUserDetail;
  properties: PropertyRecord[];
  leases: LeaseWithProperty[];
}

export async function getUserDetail(userId: string): Promise<AdminUserDetailView> {
  const user = await findUserDetailById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const [properties, leases] = await Promise.all([
    user.role === 'landlord' ? findPropertiesByOwnerId(userId) : Promise.resolve([]),
    user.role === 'tenant' ? findActivePropertiesForTenant(userId) : Promise.resolve([]),
  ]);

  return { user, properties, leases };
}
