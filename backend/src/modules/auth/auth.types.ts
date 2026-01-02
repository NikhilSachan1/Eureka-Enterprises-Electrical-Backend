import { Request } from 'express';

export interface JwtPayload {
  id: string;
  email: string;
  roles: string[];
  activeRole: string;
}

export interface UserFromRequest {
  id: string;
  email: string;
  roles: string[];
  activeRole: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user: UserFromRequest;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

export interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}
