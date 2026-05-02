export interface Project {
  id: number;
  userId: string;
  estimateNumber: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  propertyAddress: string;
  propertyType: string | null;
  projectType: string | null;
  notes: string | null;
  internalNotes: string | null;
  leadSource: string | null;
  tags: string[] | null;
  crmContactId: string | null;
  crmOpportunityId: string | null;
  crmEstimateId: string | null;
  crmSyncStatus: string | null;
  subtotal: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string | null;
  depositPercent: number | null;
  depositAmount: string | null;
  customerSignedAt: Date | null;
  customerSignatureName: string | null;
  estimatorSignedAt: Date | null;
  estimatorSignatureName: string | null;
  unsignedPdfUrl: string | null;
  signedPdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  source?: string;
}

export interface GraphNode {
  id: string;
  title: string;
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Room {
  id: number;
  projectId: number;
  name: string;
  sortOrder: number | null;
  length: string | null;
  width: string | null;
  height: string | null;
  wallSqFt: string | null;
  ceilingSqFt: string | null;
  totalSqFt: string | null;
  doorCount: number | null;
  windowCount: number | null;
  trimLinearFt: string | null;
  baseboardLinearFt: string | null;
  hasDrywallRepair: string[] | null;
  paintScope: string[] | null;
  textureScope: string[] | null;
  prepComplexity: string | null;
  repairComplexity: string | null;
  paintBrand: string | null;
  paintColor: string | null;
  paintColorCode: string | null;
  finishType: string | null;
  productLine: string | null;
  coats: number | null;
  photos: string[] | null;
  aiVisualizationUrl: string | null;
  notes: string | null;
  internalNotes: string | null;
  subtotal: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineItem {
  id: number;
  projectId: number;
  roomId: number | null;
  description: string;
  category: string | null;
  scope: string | null;
  quantity: string | null;
  unit: string | null;
  rate: string | null;
  subtotal: string | null;
  sortOrder: number | null;
  isInternal: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes: string;
  category: string;
}

export interface MediaAsset {
  id: number;
  projectId: number;
  roomId: number | null;
  url: string;
  caption: string | null;
  category: string | null;
  includeOnPdf: number | null;
  isInternal: number | null;
  sortOrder: number | null;
  createdAt: Date;
}

export interface SignatureData {
  customerName: string;
  customerSignature: string;
  customerDate: string;
  estimatorName: string;
  estimatorSignature: string;
  estimatorDate: string;
}

export interface AppState {
  currentProject: Project | null;
  currentRoom: Room | null;
  rooms: Room[];
  lineItems: LineItem[];
}

export type Screen =
  | "dashboard"
  | "new-estimate"
  | "project-setup"
  | "room-list"
  | "room-detail"
  | "ai-visualizer"
  | "estimate-builder"
  | "materials-list"
  | "pdf-preview"
  | "signature"
  | "settings"
  | "estimate-detail";
