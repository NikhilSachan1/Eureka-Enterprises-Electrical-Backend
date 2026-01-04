export const buildAssignedAssetsQuery = (userId: string) => {
  const query = `
    SELECT am.id, am."assetId", av.name
    FROM asset_masters am
    JOIN asset_versions av ON av."assetMasterId" = am.id AND av."isActive" = true
    WHERE av."assignedTo" = $1 AND am."deletedAt" IS NULL
  `;
  return { query, params: [userId] };
};

export const buildAssignedVehiclesQuery = (userId: string) => {
  const query = `
    SELECT vm.id, vv."registrationNo"
    FROM vehicle_masters vm
    JOIN vehicle_versions vv ON vv."vehicleMasterId" = vm.id AND vv."isActive" = true
    WHERE vv."assignedTo" = $1 AND vm."deletedAt" IS NULL
  `;
  return { query, params: [userId] };
};

export const buildAssignedCardsQuery = (userId: string) => {
  const query = `
    SELECT c.id, c."cardNumber", c."cardType"
    FROM cards c
    WHERE c."assignedTo" = $1 AND c."deletedAt" IS NULL AND c.status != 'INACTIVE'
  `;
  return { query, params: [userId] };
};

/**
 * Get pending expense reimbursements (approved debits not yet paid to employee)
 * transactionType = 'debit' means employee paid and needs reimbursement
 */
export const buildPendingExpenseReimbursementQuery = (userId: string) => {
  const query = `
    SELECT 
      COALESCE(SUM(CASE WHEN e."transactionType" = 'debit' THEN e.amount ELSE 0 END), 0) as "pendingDebits",
      COALESCE(SUM(CASE WHEN e."transactionType" = 'credit' THEN e.amount ELSE 0 END), 0) as "unsettledCredits",
      COUNT(*) as count
    FROM expenses e
    WHERE e."userId" = $1 
      AND e."isActive" = true
      AND e."deletedAt" IS NULL
      AND e."approvalStatus" = 'approved'
  `;
  return { query, params: [userId] };
};

/**
 * Get pending fuel expense reimbursements
 * transactionType = 'DEBIT' means employee paid and needs reimbursement
 * transactionType = 'CREDIT' means company credited and employee owes
 */
export const buildPendingFuelReimbursementQuery = (userId: string) => {
  const query = `
    SELECT 
      COALESCE(SUM(CASE WHEN fe."transactionType" = 'DEBIT' THEN fe."fuelAmount" ELSE 0 END), 0) as "pendingDebits",
      COALESCE(SUM(CASE WHEN fe."transactionType" = 'CREDIT' THEN fe."fuelAmount" ELSE 0 END), 0) as "unsettledCredits",
      COUNT(*) as count
    FROM fuel_expenses fe
    WHERE fe."userId" = $1 
      AND fe."isActive" = true
      AND fe."deletedAt" IS NULL
      AND fe."approvalStatus" = 'APPROVED'
  `;
  return { query, params: [userId] };
};
