export const SITE_VENDOR_ERRORS = {
  VENDOR_IDS_REQUIRED: 'vendorIds must not be empty',
  VENDOR_HAS_FINANCIAL_DOCS:
    'Cannot remove vendor — one or more POs / JMCs exist for this vendor on the site. Delete the financial documents first.',
} as const;

export const SITE_VENDOR_RESPONSES = {
  VENDORS_LINKED: 'Vendors linked to site',
  VENDORS_UNLINKED: 'Vendors unlinked from site',
} as const;
