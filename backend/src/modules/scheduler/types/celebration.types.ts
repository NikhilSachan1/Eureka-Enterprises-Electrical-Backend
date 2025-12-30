/**
 * Types for CRON 17: Birthday and Work Anniversary Wishes
 *
 * Sends personalized wishes to employees on their special days.
 */

export enum CelebrationType {
  BIRTHDAY = 'BIRTHDAY',
  WORK_ANNIVERSARY = 'WORK_ANNIVERSARY',
}

export interface BirthdayEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: Date;
  profilePicture?: string;
  designation?: string;
}

export interface AnniversaryEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfJoining: Date;
  yearsOfService: number;
  profilePicture?: string;
  designation?: string;
}

export interface CelebrationResult {
  birthdaysProcessed: number;
  anniversariesProcessed: number;
  birthdayEmailsSent: number;
  anniversaryEmailsSent: number;
  recipients: string[];
  errors: string[];
}

// Milestone years for special recognition
export const MILESTONE_YEARS = [1, 5, 10, 15, 20, 25, 30, 35, 40];

export interface BirthdayEmailData {
  employeeName: string;
  firstName: string;
  currentYear: number;
  adminPortalUrl: string;
}

export interface AnniversaryEmailData {
  employeeName: string;
  firstName: string;
  yearsOfService: number;
  yearsText: string;
  isMilestone: boolean;
  milestoneMessage?: string;
  dateOfJoining: string;
  currentYear: number;
  adminPortalUrl: string;
}

export interface CelebrationQueryResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: Date | null;
  dateOfJoining: Date | null;
  profilePicture: string | null;
  designation: string | null;
}
