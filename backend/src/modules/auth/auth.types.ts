import { Request } from 'express';

export interface JwtPayload {
  id: string;
  email: string;
  roles: string[];
  activeRole: string;
  /** Id of the SUPER_ADMIN acting as this user. Only present on impersonation tokens. */
  impersonatedBy?: string;
}

export interface UserFromRequest {
  id: string;
  email: string;
  roles: string[];
  activeRole: string;
  role: string;
  impersonatedBy?: string;
}

export interface AuthenticatedRequest extends Request {
  user: UserFromRequest;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  impersonatedBy?: string;
}

export interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}
