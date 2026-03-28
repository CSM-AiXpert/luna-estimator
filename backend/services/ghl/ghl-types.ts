// ─── GHL API v2 Type Definitions ───────────────────────────────────────────

export interface GHLAddress {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface GHLPhoneNumber {
  phone1?: string;
  phone2?: string;
  phone3?: string;
}

export interface GHLContact {
  id: string;
  locationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  phone1?: string;
  phone2?: string;
  phone3?: string;
  companyName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  tags: string[];
  customFields?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface GHLPipeline {
  id: string;
  locationId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface GHLPipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface GHLOpportunity {
  id: string;
  locationId: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  maxVal: number;
  monetaryValue: number;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  pipelineStageName?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface GHLTag {
  id: string;
  name: string;
  color?: string;
  locationId: string;
}

export interface GHLNote {
  id: string;
  contactId?: string;
  opportunityId?: string;
  body: string;
  type: 'Log' | 'Call' | 'Email' | 'Meeting' | 'Task';
  createdAt: string;
  updatedAt: string;
}

export interface GHLWebhookEvent {
  type: string;
  locationId: string;
  contactId?: string;
  opportunityId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ─── Request Types ──────────────────────────────────────────────────────────

export interface CreateContactRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  phone1?: string;
  companyName?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  locationId: string;
  tags?: string[];
  customFields?: Record<string, string>;
}

export interface UpdateContactRequest extends Partial<CreateContactRequest> {
  id: string;
}

export interface SearchContactsRequest {
  locationId: string;
  email?: string;
  phone?: string;
  name?: string;
  limit?: number;
  skip?: number;
}

export interface CreateOpportunityRequest {
  name: string;
  locationId: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  maxVal: number;
  status?: 'open' | 'won' | 'lost';
  source?: string;
}

export interface UpdateOpportunityRequest {
  id: string;
  name?: string;
  maxVal?: number;
  monetaryValue?: number;
  status?: 'open' | 'won' | 'lost';
  pipelineStageId?: string;
  contactId?: string;
}

export interface MoveOpportunityStageRequest {
  pipelineStageId: string;
}

export interface AddNoteRequest {
  body: string;
  type?: 'Log' | 'Call' | 'Email' | 'Meeting' | 'Task';
}

export interface AddTagRequest {
  tag: string;
}

// ─── Response Types ─────────────────────────────────────────────────────────

export interface GHLListResponse<T> {
  results: T[];
  total: number;
  page: number;
  pageLimit: number;
}

export interface GHLApiError {
  status: number;
  message: string;
  code?: string;
}

// ─── Webhook Types ──────────────────────────────────────────────────────────

export type GHLWebhookEventType =
  | 'contact.create'
  | 'contact.update'
  | 'contact.delete'
  | 'opportunity.create'
  | 'opportunity.update'
  | 'opportunity.stage_update'
  | 'opportunity.delete';

export interface GHLWebhookPayload {
  event: GHLWebhookEventType;
  locationId: string;
  timestamp: string;
  contactId?: string;
  opportunityId?: string;
  data: GHLContact | GHLOpportunity;
}
