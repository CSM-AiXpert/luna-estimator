export const siteConfig = {
  title: "Luna Estimator",
  description: "Premium mobile-first estimator for Luna Drywall & Paint",
  company: "Luna Drywall & Paint",
  tagline: "Professional Estimating",
  language: "en",
  state: "South Carolina",
};

export const appConfig = {
  version: "1.0.0",
  currency: "USD",
  currencySymbol: "$",
  defaultTaxRate: 0,
  defaultDepositPercent: 50,
  defaultLaborRate: 45,
  defaultPaintCostPerGallon: 55,
  maxPhotosPerRoom: 12,
  maxProjectPhotos: 20,
};

export const statusLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: "Draft", color: "#888", bgColor: "rgba(136,136,136,0.12)" },
  ready_for_review: { label: "Ready", color: "#e0af68", bgColor: "rgba(224,175,104,0.12)" },
  sent: { label: "Sent", color: "#5a9fd4", bgColor: "rgba(90,159,212,0.12)" },
  signed: { label: "Signed", color: "#7dac5a", bgColor: "rgba(125,172,90,0.12)" },
  deposit_requested: { label: "Deposit", color: "#c8956c", bgColor: "rgba(200,149,108,0.12)" },
  in_pipeline: { label: "Pipeline", color: "#a080d4", bgColor: "rgba(160,128,212,0.12)" },
  completed: { label: "Done", color: "#7dac5a", bgColor: "rgba(125,172,90,0.12)" },
  archived: { label: "Archived", color: "#555", bgColor: "rgba(85,85,85,0.12)" },
};

export const propertyTypes = [
  "Single Family",
  "Townhouse",
  "Condo",
  "Multi-Family",
  "Commercial",
  "Rental Property",
  "New Construction",
];

export const projectTypes = [
  "Interior Painting",
  "Exterior Painting",
  "Drywall Repair",
  "Full Drywall",
  "Texture Work",
  "Popcorn Removal",
  "Cabinet Painting",
  "Trim & Baseboards",
  "Ceiling Repair",
  "Water Damage Repair",
  "Full Renovation",
  "Touch-ups",
];

export const paintBrands = [
  "Sherwin-Williams",
  "Benjamin Moore",
  "Behr",
  "Valspar",
  "PPG",
  "Dunn-Edwards",
  "Farrow & Ball",
  "Other",
];

export const finishTypes = [
  "Flat / Matte",
  "Eggshell",
  "Satin",
  "Semi-Gloss",
  "High-Gloss",
  "Pearl",
];

export const prepComplexityOptions = [
  { value: "minimal", label: "Minimal", description: "Clean surfaces, light sanding" },
  { value: "standard", label: "Standard", description: "Wash, sand, patch minor holes" },
  { value: "extensive", label: "Extensive", description: "Heavy prep, multiple repairs, priming" },
  { value: "restoration", label: "Restoration", description: "Full surface restoration needed" },
];

export const repairComplexityOptions = [
  { value: "none", label: "None", description: "No drywall repair needed" },
  { value: "minor", label: "Minor", description: "Small holes, nail pops, minor cracks" },
  { value: "moderate", label: "Moderate", description: "Medium holes, tape seams, corner repair" },
  { value: "extensive", label: "Extensive", description: "Large holes, water damage, full sections" },
  { value: "replacement", label: "Replacement", description: "Full wall/ceiling replacement" },
];

export const paintScopeOptions = [
  { value: "walls", label: "Walls" },
  { value: "ceiling", label: "Ceiling" },
  { value: "trim", label: "Trim" },
  { value: "doors", label: "Doors" },
  { value: "windows", label: "Windows" },
  { value: "baseboards", label: "Baseboards" },
  { value: "crown_molding", label: "Crown Molding" },
  { value: "cabinets", label: "Cabinets" },
];

export const drywallRepairOptions = [
  { value: "nail_pops", label: "Nail Pops" },
  { value: "small_holes", label: "Small Holes" },
  { value: "large_holes", label: "Large Holes" },
  { value: "cracks", label: "Cracks" },
  { value: "water_damage", label: "Water Damage" },
  { value: "texture_repair", label: "Texture Repair" },
  { value: "tape_seams", label: "Tape Seams" },
  { value: "corner_bead", label: "Corner Bead" },
  { value: "sagging_ceiling", label: "Sagging Ceiling" },
];

export const unitTypes = [
  { value: "sqft", label: "Sq Ft" },
  { value: "linear_ft", label: "Linear Ft" },
  { value: "ea", label: "Each" },
  { value: "hr", label: "Hours" },
  { value: "gal", label: "Gallons" },
  { value: "sheet", label: "Sheets" },
  { value: "roll", label: "Rolls" },
  { value: "box", label: "Boxes" },
];

// South Carolina contractor disclaimers
export const scDisclaimers = {
  general: "This estimate is based on a visual inspection and represents our professional assessment of the work described. Actual conditions may vary once work begins.",
  colorVariation: "Paint colors may appear different depending on lighting conditions, surface texture, and adjacent colors. We recommend purchasing sample quarts and viewing them in the actual space before finalizing color selections.",
  surfacePrep: "This estimate assumes surfaces are in the condition observed during assessment. Hidden damage, previous improper repairs, or substrate issues discovered after work begins may require additional work and cost.",
  changeOrder: "Any changes to the scope of work, materials, or specifications after signing will require a written change order and may affect the final price and timeline.",
  customerResponsibility: "Customer is responsible for removing all personal items, artwork, electronics, and fragile objects from work areas before the scheduled start date. Furniture should be moved to the center of the room or cleared as discussed.",
  moisture: "We are not responsible for paint failure or substrate damage caused by moisture intrusion, leaks, or inadequate ventilation. Any moisture issues should be resolved prior to painting.",
  scheduling: "Project start dates are estimated and subject to change due to weather, material availability, or unforeseen circumstances. We will provide advance notice of any schedule changes.",
  payment: `A ${appConfig.defaultDepositPercent}% deposit is required to secure your project start date. The remaining balance is due upon substantial completion. We accept cash, check, and major credit cards (3% processing fee applies to card payments).`,
  touchup: "After project completion, we will conduct a walkthrough to address any touch-ups. Touch-up requests must be submitted within 5 business days of project completion.",
  textureMatching: "While we make every effort to match existing wall and ceiling textures, perfect texture matching cannot be guaranteed due to age, application method differences, and material variations.",
  sheen: "Paint sheen may appear different on various surfaces and under different lighting conditions. Higher sheen levels will highlight surface imperfections.",
  exclusions: "This estimate does not include: moving of heavy furniture, electrical/plumbing work, carpentry repairs, asbestos/lead abatement, permit fees, or work in areas not specifically described herein.",
};

export const defaultEstimateTerms = `PAYMENT TERMS
${appConfig.defaultDepositPercent}% deposit due upon acceptance to secure start date. Balance due upon substantial completion.

CANCELLATION POLICY
Cancellations within 48 hours of scheduled start may forfeit deposit. Rescheduling is always preferred.

WARRANTY
One-year limited warranty on workmanship. Paint manufacturer warranty applies to materials.

PROPERTY ACCESS
Customer will provide access to work areas during business hours (8 AM - 6 PM, Monday-Friday).

INSURANCE
Fully licensed and insured in the state of South Carolina.`;

export const materialsDefaults = {
  paintCoveragePerGallon: 350,
  primerCoveragePerGallon: 300,
  drywallSheetSize: { width: 4, height: 8, sqft: 32 },
  mudPerSheet: 0.5,
  tapePerSheet: 4,
  screwsPerSheet: 32,
  caulkPerRoom: 1,
  rollerPer200Sqft: 1,
  brushPerRoom: 0.5,
};

export const starterNotes: Array<{ title: string; content: string; tags?: string[]; source?: string }> = [
  {
    title: "Welcome",
    content: "Use this space for estimate notes, change orders, and client context.",
    tags: ["starter"],
  },
];

export const storageConfig = {
  notesKey: "luna-estimator-notes",
};

export const graphConfig = {
  notesLabel: "notes",
  connectionsLabel: "connections",
  emptyGraphLabel: "No linked notes yet",
};

export const moonConfig = {
  iconLabel: "Moon phase",
  phaseLabels: [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent",
  ],
};

export const editorConfig = {
  editLabel: "Edit",
  previewLabel: "Preview",
  sourceLabel: "Source",
  deleteLabel: "Delete",
  cancelLabel: "Cancel",
  titlePlaceholder: "Untitled note",
  contentPlaceholder: "Write your notes here...",
  outgoingLinksLabel: "Links to",
  incomingLinksLabel: "Linked from",
};

export const sidebarConfig = {
  emptyLabel: "No notes yet",
  emptyNotesLabel: "No notes yet",
  noResultsLabel: "No matching notes",
  searchPlaceholder: "Search notes...",
  clearSelectionLabel: "Clear selection",
  selectAllLabel: "Select all",
  selectedCountSuffix: "selected",
  deleteSelectedLabel: "Delete",
  cancelLabel: "Cancel",
  newNoteLabel: "New Note",
  manageLabel: "Manage",
};
