/** Words for orgs/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** OrgBasicFields.tsx */
export const ORG_BASIC_FIELDS_COPY = {
  organisationCode: "Organisation Code",
  assignedAutomaticallyCodesNeverChange: "Assigned automatically — codes never change",
  organisationName: "Organisation Name",
  abcTraders: "ABC Traders",
  email: "Email",
  orgExampleCom: "org@example.com",
  phone: "Phone",
  contactPerson: "Contact Person",
  johnDoe: "John Doe",
  basicInformation: "Basic information",
} as const;

/** OrgBusinessFields.tsx */
export const ORG_BUSINESS_FIELDS_COPY = {
  businessName: "Business Name",
  abcTradersPvtLtd: "ABC Traders Pvt Ltd",
  gstNumber: "GST Number",
  t15DigitGstinOptional: "15-digit GSTIN (optional)",
  panNumber: "PAN Number",
  t10CharacterPanOptional: "10-character PAN (optional)",
  description: "Description",
  briefDescriptionAboutTheOrg: "Brief description about the org...",
  businessDetailsOptional: "Business details (optional)",
} as const;

/** index.tsx */
export const INDEX_COPY = {
  activeStatus: "Active Status",
  inactiveOrgsCannotListNew: "Inactive orgs cannot list new products",
  close: "Close",
} as const;

export const ORG_FORM_SUBMIT_COPY = {
  update: "Update Organisation",
  create: "Create Organisation",
} as const;
