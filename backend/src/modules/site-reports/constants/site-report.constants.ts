export const REPORT_ERRORS = {
  NOT_FOUND: 'Report not found',
  JMC_NOT_FOUND: 'Parent JMC not found',
  JMC_NOT_APPROVED: 'Parent JMC must be approved before creating a Report',
  REPORT_ALREADY_EXISTS_FOR_JMC: 'A Report already exists for this JMC (1 JMC = 1 Report)',
  REPORT_NUMBER_EXISTS: 'Report number already exists for this JMC',
  CANNOT_EDIT_APPROVED: 'Cannot edit an approved report — it is locked.',
  CANNOT_DELETE_APPROVED: 'Cannot delete an approved report — it is locked.',
  ALREADY_APPROVED: 'Report is already approved.',
  CANNOT_REJECT_APPROVED: 'Cannot reject an already approved report.',
  ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK: 'Only APPROVED locked reports can request unlock.',
};

export const REPORT_RESPONSES = {
  CREATED: 'Report created successfully',
  UPDATED: 'Report updated successfully',
  DELETED: 'Report deleted successfully',
  APPROVED: 'Report approved successfully.',
  REJECTED: 'Report rejected successfully.',
  UNLOCK_REQUESTED: 'Unlock request submitted',
  UNLOCK_GRANTED: 'Report unlocked',
  UNLOCK_REJECTED: 'Unlock request rejected — report remains locked',
};
