import { Request } from 'express';
import { AnnouncementEntity } from './entities/announcement.entity';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string[];
  };
}

export interface AnnouncementWithAck extends AnnouncementEntity {
  acknowledged: boolean;
}

export interface AcknowledgementStats {
  total: number;
  acknowledged: number;
  pending: number;
}

export interface BulkOperationResult {
  success: string[];
  failed: { id: string; error: string }[];
}
