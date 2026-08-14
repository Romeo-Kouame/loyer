export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Passed explicitly from controllers into services that need to record an
// audit log entry - services never touch the raw Express Request.
export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: Date;
}
