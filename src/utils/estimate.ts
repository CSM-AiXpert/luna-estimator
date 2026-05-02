import { appConfig, materialsDefaults, scDisclaimers } from '@/config';
import type { LineItem, Room } from '@/types';

export interface MaterialCalc {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  notes: string;
}

export interface SuggestedLineItem {
  description: string;
  category: string;
  scope: string;
  quantity: number;
  unit: string;
  rate: number;
  subtotal: number;
  sortOrder: number;
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value: string | number | null | undefined): string {
  return toNumber(value).toLocaleString('en-US', {
    style: 'currency',
    currency: appConfig.currency,
    minimumFractionDigits: 2,
  });
}

export function computeRoomMetrics(input: {
  length?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
  wallSqFt?: string | number | null;
  ceilingSqFt?: string | number | null;
}) {
  const length = toNumber(input.length);
  const width = toNumber(input.width);
  const height = toNumber(input.height);

  const autoFloorSqFt = length && width ? length * width : 0;
  const autoWallSqFt = length && width && height ? 2 * (length + width) * height : 0;
  const autoCeilingSqFt = autoFloorSqFt;
  const wallSqFt = toNumber(input.wallSqFt) || autoWallSqFt;
  const ceilingSqFt = toNumber(input.ceilingSqFt) || autoCeilingSqFt;

  return {
    length,
    width,
    height,
    floorSqFt: autoFloorSqFt,
    wallSqFt,
    ceilingSqFt,
    totalSqFt: wallSqFt + ceilingSqFt,
    totalSurfaceSqFt: autoFloorSqFt + wallSqFt + ceilingSqFt,
  };
}

export function calculateProjectTotals(lineItems: LineItem[], taxRate = 0, discount = 0) {
  const customerItems = lineItems.filter((item) => !item.isInternal);
  const subtotal = customerItems.reduce((sum, item) => sum + toNumber(item.subtotal), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;
  const depositAmount = total * ((appConfig.defaultDepositPercent || 0) / 100);

  return {
    customerItems,
    subtotal,
    taxAmount,
    total,
    discount,
    depositAmount,
  };
}

export function buildSuggestedLineItems(room: Room): SuggestedLineItem[] {
  const wallSqFt = toNumber(room.wallSqFt);
  const ceilingSqFt = toNumber(room.ceilingSqFt);
  const trimLinearFt = toNumber(room.trimLinearFt) || toNumber(room.baseboardLinearFt);
  const baseboardLinearFt = toNumber(room.baseboardLinearFt);
  const doorCount = toNumber(room.doorCount);
  const windowCount = toNumber(room.windowCount);
  const coats = Math.max(toNumber(room.coats), 1) || 2;
  const prepMultiplier =
    room.prepComplexity === 'extensive' ? 1.35 :
    room.prepComplexity === 'restoration' ? 1.6 :
    room.prepComplexity === 'minimal' ? 0.85 :
    1;
  const repairMultiplier =
    room.repairComplexity === 'replacement' ? 2.5 :
    room.repairComplexity === 'extensive' ? 1.8 :
    room.repairComplexity === 'moderate' ? 1.35 :
    room.repairComplexity === 'minor' ? 1.1 :
    1;

  const items: SuggestedLineItem[] = [];
  let sortOrder = 0;

  const addItem = (
    description: string,
    category: string,
    scope: string,
    quantity: number,
    unit: string,
    rate: number,
  ) => {
    if (quantity <= 0 || rate <= 0) return;
    items.push({
      description,
      category,
      scope,
      quantity,
      unit,
      rate,
      subtotal: Number((quantity * rate).toFixed(2)),
      sortOrder: sortOrder++,
    });
  };

  if (room.paintScope?.includes('walls') && wallSqFt > 0) {
    addItem(`${room.name} - Wall Painting`, 'Paint', 'Paint - Walls', wallSqFt, 'sqft', 1.85 * coats * prepMultiplier);
  }

  if (room.paintScope?.includes('ceiling') && ceilingSqFt > 0) {
    addItem(`${room.name} - Ceiling Painting`, 'Paint', 'Paint - Ceiling', ceilingSqFt, 'sqft', 1.45 * coats * prepMultiplier);
  }

  if ((room.paintScope?.includes('trim') || room.paintScope?.includes('crown_molding')) && trimLinearFt > 0) {
    addItem(`${room.name} - Trim Painting`, 'Paint', 'Paint - Trim', trimLinearFt, 'linear_ft', 2.75 * coats,);
  }

  if (room.paintScope?.includes('baseboards') && baseboardLinearFt > 0) {
    addItem(`${room.name} - Baseboard Painting`, 'Paint', 'Paint - Trim', baseboardLinearFt, 'linear_ft', 2.1 * coats);
  }

  if (room.paintScope?.includes('doors') && doorCount > 0) {
    addItem(`${room.name} - Door Painting`, 'Paint', 'Paint - Doors', doorCount, 'ea', 85 * coats);
  }

  if (room.paintScope?.includes('windows') && windowCount > 0) {
    addItem(`${room.name} - Window Trim Painting`, 'Paint', 'Paint - Trim', windowCount, 'ea', 45 * coats);
  }

  if (room.hasDrywallRepair && room.hasDrywallRepair.length > 0) {
    const repairArea = Math.max(wallSqFt * 0.12, 32);
    addItem(
      `${room.name} - Drywall Repair & Prep`,
      'Drywall',
      'Drywall Repair',
      repairArea,
      'sqft',
      3.25 * repairMultiplier,
    );
  }

  if (room.prepComplexity && room.prepComplexity !== 'minimal' && wallSqFt > 0) {
    addItem(
      `${room.name} - Prep Work`,
      'Labor',
      'Prep Work',
      Math.max(wallSqFt * 0.15, 1),
      'hr',
      appConfig.defaultLaborRate * (prepMultiplier - 0.15),
    );
  }

  return items;
}

export function calculateRoomCompletion(room: Room) {
  const metrics = computeRoomMetrics(room);
  const checklist = [
    room.name?.trim(),
    metrics.wallSqFt > 0 || metrics.ceilingSqFt > 0,
    room.paintScope?.length,
    room.paintBrand || room.paintColor || room.paintColorCode,
    room.finishType,
  ];

  const completed = checklist.filter(Boolean).length;
  const total = checklist.length;

  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  };
}

export function calculateMaterials(
  rooms: Array<Pick<
    Room,
    | 'wallSqFt'
    | 'ceilingSqFt'
    | 'doorCount'
    | 'windowCount'
    | 'trimLinearFt'
    | 'baseboardLinearFt'
    | 'coats'
    | 'hasDrywallRepair'
    | 'paintScope'
    | 'paintBrand'
    | 'paintColor'
  >>
): MaterialCalc[] {
  const mats: MaterialCalc[] = [];

  let totalWallSqFt = 0;
  let totalCeilingSqFt = 0;
  let totalTrimLf = 0;
  let totalRooms = rooms.length;
  let needsDrywallRepair = false;
  let maxCoats = 2;

  rooms.forEach((room) => {
    totalWallSqFt += toNumber(room.wallSqFt);
    totalCeilingSqFt += toNumber(room.ceilingSqFt);
    totalTrimLf += toNumber(room.trimLinearFt) || toNumber(room.baseboardLinearFt);
    maxCoats = Math.max(maxCoats, room.coats || 2);
    if (room.hasDrywallRepair && room.hasDrywallRepair.length > 0) needsDrywallRepair = true;
  });

  const totalPaintSqFt = totalWallSqFt + totalCeilingSqFt;

  if (totalPaintSqFt > 0) {
    mats.push({
      name: 'Interior Paint',
      quantity: Math.ceil((totalPaintSqFt * maxCoats) / materialsDefaults.paintCoveragePerGallon),
      unit: 'gallons',
      category: 'Paint',
      notes: `${totalPaintSqFt.toLocaleString()} sq ft across ${maxCoats} coat(s)`,
    });
  }

  if (totalTrimLf > 0) {
    mats.push({
      name: 'Trim Paint',
      quantity: Math.max(1, Math.ceil((totalTrimLf * 2) / 400)),
      unit: 'gallons',
      category: 'Paint',
      notes: `${totalTrimLf.toLocaleString()} linear ft of trim/baseboard`,
    });
  }

  if (totalWallSqFt > 0) {
    mats.push({
      name: 'Primer',
      quantity: Math.ceil(totalWallSqFt / materialsDefaults.primerCoveragePerGallon),
      unit: 'gallons',
      category: 'Paint',
      notes: 'Allow for stain blocking, repairs, and porous surfaces',
    });
  }

  if (needsDrywallRepair) {
    const sheets = Math.ceil((totalWallSqFt / materialsDefaults.drywallSheetSize.sqft) * 0.05);
    mats.push({
      name: 'Drywall Sheets (4x8)',
      quantity: Math.max(2, sheets),
      unit: 'sheets',
      category: 'Drywall',
      notes: 'Allowance for patching and cutouts',
    });
    mats.push({
      name: 'Joint Compound',
      quantity: Math.ceil(Math.max(2, sheets) * materialsDefaults.mudPerSheet),
      unit: 'buckets',
      category: 'Drywall',
      notes: 'Pre-mixed finishing compound',
    });
    mats.push({
      name: 'Drywall Tape',
      quantity: Math.max(1, Math.ceil((Math.max(2, sheets) * materialsDefaults.tapePerSheet) / 250)),
      unit: 'rolls',
      category: 'Drywall',
      notes: 'Paper tape for seams and patches',
    });
  }

  if (totalRooms > 0) {
    mats.push(
      {
        name: "Painter's Tape",
        quantity: Math.ceil(totalRooms * 2),
        unit: 'rolls',
        category: 'Supplies',
        notes: 'Protection for trim, floors, and hardware',
      },
      {
        name: 'Plastic Sheeting',
        quantity: Math.ceil(totalRooms),
        unit: 'rolls',
        category: 'Supplies',
        notes: 'Dust and overspray containment',
      },
      {
        name: 'Drop Cloths',
        quantity: Math.ceil(totalRooms * 2),
        unit: 'ea',
        category: 'Supplies',
        notes: 'Reusable floor protection',
      },
      {
        name: 'Caulk',
        quantity: Math.ceil(totalRooms * materialsDefaults.caulkPerRoom),
        unit: 'tubes',
        category: 'Supplies',
        notes: 'Paintable latex caulk',
      },
      {
        name: 'Roller Covers',
        quantity: Math.ceil(totalPaintSqFt / 200) || totalRooms,
        unit: 'ea',
        category: 'Supplies',
        notes: '3/8" nap for standard interior walls',
      },
      {
        name: 'Angled Brushes',
        quantity: Math.max(1, Math.ceil(totalRooms * materialsDefaults.brushPerRoom)),
        unit: 'ea',
        category: 'Supplies',
        notes: 'Cut-ins, doors, and touchups',
      }
    );
  }

  return mats.filter((item) => item.quantity > 0);
}

export const disclaimerSections = [
  { title: 'General Workmanship Notice', body: scDisclaimers.general },
  { title: 'Color Variation Notice', body: scDisclaimers.colorVariation },
  { title: 'Surface Preparation & Hidden Damage Notice', body: scDisclaimers.surfacePrep },
  { title: 'Change Order Notice', body: scDisclaimers.changeOrder },
  { title: 'Customer Responsibility Notice', body: scDisclaimers.customerResponsibility },
  { title: 'Moisture & Substrate Condition Notice', body: scDisclaimers.moisture },
  { title: 'Scheduling & Access Notice', body: scDisclaimers.scheduling },
  { title: 'Payment & Deposit Notice', body: scDisclaimers.payment },
  { title: 'Touch-Up & Final Walkthrough Notice', body: scDisclaimers.touchup },
  { title: 'Texture Matching Limitation Notice', body: scDisclaimers.textureMatching },
  { title: 'Paint Sheen & Lighting Perception Notice', body: scDisclaimers.sheen },
  { title: 'Exclusions & Unforeseen Conditions Notice', body: scDisclaimers.exclusions },
];
