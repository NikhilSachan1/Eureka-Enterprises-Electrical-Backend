/**
 * Site-invoice-related SQL queries
 */

/**
 * Insert a GST register entry for an approved invoice.
 * Uses ON CONFLICT DO NOTHING to guard against duplicate projections.
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
 * Insert a TDS register entry for an approved invoice.
 * Uses ON CONFLICT DO NOTHING to guard against duplicate projections.
 */
export const insertTdsRegisterEntryQuery = `
  INSERT INTO tds_register_entries
    (id, "invoiceId", "siteId", "partyType", "contractorId", "vendorId",
     "invoiceMonth", "financialYear", "taxableAmount", "tdsAmount",
     "isVerified", "createdAt", "updatedAt")
  VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW(), NOW())
  ON CONFLICT DO NOTHING
`;
