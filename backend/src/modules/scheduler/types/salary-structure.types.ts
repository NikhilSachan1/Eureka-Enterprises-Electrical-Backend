/**
 * Types for CRON 18: Salary Structure Activation/Deactivation
 *
 * Automatically manages salary structure transitions based on effective dates.
 */

export interface SalaryStructureActivationResult {
  structuresActivated: number;
  structuresDeactivated: number;
  previousStructuresUpdated: number;
  usersAffected: string[];
  errors: string[];
}

export interface PendingActivationStructure {
  id: string;
  userId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  previousStructureId: string | null;
  incrementType: string;
  grossSalary: number;
  netSalary: number;
  ctc: number;
  // User info
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ActiveStructureToDeactivate {
  id: string;
  userId: string;
  effectiveFrom: Date;
  effectiveTo: Date;
  isActive: boolean;
  // User info
  employeeId: string;
  firstName: string;
  lastName: string;
}

export interface CurrentActiveStructure {
  id: string;
  userId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
}

export interface ActivationLogEntry {
  structureId: string;
  userId: string;
  employeeName: string;
  action: 'ACTIVATED' | 'DEACTIVATED' | 'SUPERSEDED';
  effectiveFrom: Date;
  effectiveTo?: Date;
  grossSalary?: number;
  ctc?: number;
}
