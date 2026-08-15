import { getPlatformOverview, listAllUsers, PlatformOverview, PlatformUserSummary } from '../repositories/admin.repository';

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
