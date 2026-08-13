export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
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
