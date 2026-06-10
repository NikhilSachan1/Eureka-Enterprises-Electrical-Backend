/**
 * Site-invoice-related SQL queries
 */

/**
 * Upsert a GST register entry for an approved invoice.
 *
 * ON CONFLICT ("invoiceId", "financialYear"):
 *   - If the entry is NOT yet verified and NOT yet linked to a GST payment:
 *     update the amounts and month/year (invoice may have been edited after
 *     the first approval).
 *   - If already verified or paid: do nothing (amounts are locked in).
 */
export const insertGstRegisterEntryQuery = `
  INSERT INTO gst_register_entries
    (id, "invoiceId", "siteId", "partyType", "contractorId", "vendorId",
     "invoiceMonth", "financialYear", "gstType", "taxableAmount", "gstAmount",
     "isVerified", "createdAt", "updatedAt")
  VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, NOW(), NOW())
  ON CONFLICT DO NOTHING
`;

/**
 * Delete an unverified, unpaid GST register entry for an invoice.
 * Called before every re-insert so that edits to taxable/gst amounts,
 * invoice date (FY shift), or party are picked up on re-approval.
 * Safe: does nothing if the entry is verified or payment-released.
 */
export const deleteGstRegisterEntryForInvoiceQuery = `
  DELETE FROM gst_register_entries
  WHERE "invoiceId" = $1
    AND "isVerified" = false
    AND "gstPaymentId" IS NULL
`;

/**
 * Upsert a TDS register entry from a book payment (PURCHASE side).
 * ON CONFLICT: updates amounts when not yet verified or paid.
 */
export const insertTdsRegisterEntryFromBookPaymentQuery = `
  INSERT INTO tds_register_entries
    (id, "invoiceId", "bookPaymentId", "siteId", "partyType", "contractorId", "vendorId",
     "invoiceMonth", "financialYear", "taxableAmount", "tdsAmount",
     "isVerified", "createdAt", "updatedAt")
  VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, NOW(), NOW())
  ON CONFLICT DO NOTHING
`;

/**
 * Delete an unverified, unpaid TDS register entry for a book payment.
 * Called before re-insert on edit, and on delete of the book payment.
 */
export const deleteTdsRegisterEntryForBookPaymentQuery = `
  DELETE FROM tds_register_entries
  WHERE "bookPaymentId" = $1
    AND "isVerified" = false
    AND "tdsPaymentId" IS NULL
`;

/**
 * Upsert a TDS register entry from a SALE-side bank transfer.
 * ON CONFLICT: updates amounts when not yet verified or paid.
 */
export const insertTdsRegisterEntryFromBankTransferQuery = `
  INSERT INTO tds_register_entries
    (id, "invoiceId", "bankTransferId", "siteId", "partyType", "contractorId", "vendorId",
     "invoiceMonth", "financialYear", "taxableAmount", "tdsAmount",
     "isVerified", "createdAt", "updatedAt")
  VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, NOW(), NOW())
  ON CONFLICT DO NOTHING
`;

/**
 * Delete an unverified, unpaid TDS register entry for a bank transfer.
 * Called before re-insert on edit, and on delete of the bank transfer.
 */
export const deleteTdsRegisterEntryForBankTransferQuery = `
  DELETE FROM tds_register_entries
  WHERE "bankTransferId" = $1
    AND "isVerified" = false
    AND "tdsPaymentId" IS NULL
`;

/**
 * Insert a TDS register entry when an invoice is approved (both SALE and PURCHASE).
 * bookPaymentId and bankTransferId are NULL — TDS is now at invoice level.
 * $1=invoiceId, $2=siteId, $3=partyType, $4=contractorId, $5=vendorId,
 * $6=invoiceMonth, $7=financialYear, $8=taxableAmount, $9=tdsAmount
 */
export const insertTdsRegisterEntryFromInvoiceQuery = `
  INSERT INTO tds_register_entries
    (id, "invoiceId", "siteId", "partyType", "contractorId", "vendorId",
     "invoiceMonth", "financialYear", "taxableAmount", "tdsAmount",
     "isVerified", "createdAt", "updatedAt")
  VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW(), NOW())
  ON CONFLICT DO NOTHING
`;

/**
 * Delete an unverified, unpaid invoice-level TDS register entry.
 * Targets only entries where bookPaymentId IS NULL and bankTransferId IS NULL
 * (i.e., entries created from invoice approval, not from book payments or transfers).
 * Called on invoice grantUnlock to allow re-projection on re-approval.
 */
export const deleteTdsRegisterEntryForInvoiceQuery = `
  DELETE FROM tds_register_entries
  WHERE "invoiceId" = $1
    AND "bookPaymentId" IS NULL
    AND "bankTransferId" IS NULL
    AND "isVerified" = false
    AND "tdsPaymentId" IS NULL
`;
