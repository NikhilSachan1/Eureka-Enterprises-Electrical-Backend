import {
  CalibrationStatus,
  WarrantyStatus,
} from '../../asset-masters/constants/asset-masters.constants';

/**
 * Types for CRON 13: Asset Calibration Expiry Alerts
 */

export interface CalibrationAlert {
  calibrationEndDate: Date;
  daysUntilExpiry: number;
  status: CalibrationStatus;
  calibrationFrom: string | null;
  calibrationFrequency: string | null;
}

export interface AssetCalibrationAlert {
  assetVersionId: string;
  assetMasterId: string;
  assetId: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  category: string;
  status: string;
  assignedTo: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  calibration: CalibrationAlert;
}

export interface CalibrationExpiryCount {
  expired: number;
  expiringSoon: number;
  total: number;
}

export interface AssetCalibrationExpiryResult {
  totalAssetsProcessed: number;
  expiredCalibrations: CalibrationExpiryCount;
  expiringSoonCalibrations: CalibrationExpiryCount;
  emailsSent: number;
  recipients: string[];
  errors: string[];
}

export interface AssetCalibrationEmailItem {
  assetId: string;
  name: string;
  model: string;
  serialNumber: string;
  category: string;
  assetStatus: string;
  assignedTo: string;
  calibrationEndDate: string;
  calibrationFrom: string;
  calibrationFrequency: string;
  daysText: string;
  statusClass: 'expired' | 'expiring-soon';
}

export interface AssetCalibrationEmailData {
  currentYear: number;
  adminPortalUrl: string;
  totalExpired: number;
  totalExpiringSoon: number;
  expiredAssets: AssetCalibrationEmailItem[];
  expiringSoonAssets: AssetCalibrationEmailItem[];
  hasExpired: boolean;
  hasExpiringSoon: boolean;
}

/**
 * Types for CRON 14: Asset Warranty Expiry Alerts
 */

export interface WarrantyAlert {
  warrantyEndDate: Date;
  daysUntilExpiry: number;
  status: WarrantyStatus;
  warrantyStartDate: Date | null;
  vendorName: string | null;
}

export interface AssetWarrantyAlert {
  assetVersionId: string;
  assetMasterId: string;
  assetId: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  category: string;
  status: string;
  assignedTo: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  warranty: WarrantyAlert;
}

export interface WarrantyExpiryCount {
  expired: number;
  expiringSoon: number;
  total: number;
}

export interface AssetWarrantyExpiryResult {
  totalAssetsProcessed: number;
  expiredWarranties: WarrantyExpiryCount;
  expiringSoonWarranties: WarrantyExpiryCount;
  emailsSent: number;
  recipients: string[];
  errors: string[];
}

export interface AssetWarrantyEmailItem {
  assetId: string;
  name: string;
  model: string;
  serialNumber: string;
  category: string;
  assetStatus: string;
  assignedTo: string;
  warrantyEndDate: string;
  warrantyStartDate: string;
  vendorName: string;
  daysText: string;
  statusClass: 'expired' | 'expiring-soon';
}

export interface AssetWarrantyEmailData {
  currentYear: number;
  adminPortalUrl: string;
  totalExpired: number;
  totalExpiringSoon: number;
  expiredAssets: AssetWarrantyEmailItem[];
  expiringSoonAssets: AssetWarrantyEmailItem[];
  hasExpired: boolean;
  hasExpiringSoon: boolean;
}
