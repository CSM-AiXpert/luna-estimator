// ─── Luna ↔ GoHighLevel Field Mappings ──────────────────────────────────────
// Aligned with Luna DB schema:
//   project_status: 'lead' | 'bid' | 'active' | 'completed' | 'cancelled'
//   estimate_status: 'draft' | 'sent' | 'approved' | 'rejected' | 'revised'

import type {
  GHLContact,
  CreateContactRequest,
  CreateOpportunityRequest,
  UpdateOpportunityRequest,
} from './ghl-types';

// ─── Contact Mappings ────────────────────────────────────────────────────────

export const CONTACT_MAPPING = {
  luna_to_ghl: {
    first_name: 'firstName',
    last_name: 'lastName',
    email: 'email',
    phone: 'phone1',
    company_name: 'companyName',
    address_line1: 'address1',
    city: 'city',
    state: 'state',
    postal_code: 'postalCode',
    country: 'country',
  } as const,

  ghl_to_luna: {
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    phone1: 'phone',
    phone: 'phone',
    companyName: 'company_name',
    address1: 'address_line1',
    address2: 'address_line2',
    city: 'city',
    state: 'state',
    postalCode: 'postal_code',
    country: 'country',
  } as const,
} as const;

// ─── Opportunity Mappings ────────────────────────────────────────────────────

export const OPPORTUNITY_MAPPING = {
  luna_to_ghl: {
    name: 'name',
    estimated_value: 'maxVal',
    monetaryValue: 'monetaryValue',
    status: 'status',
    source: 'source',
  } as const,

  ghl_to_luna: {
    name: 'name',
    maxVal: 'estimated_value',
    monetaryValue: 'estimated_value',
    status: 'status',
    source: 'source',
  } as const,
} as const;

// ─── Luna Status → GHL Status ────────────────────────────────────────────────
// project_status: 'lead' | 'bid' | 'active' | 'completed' | 'cancelled'
// estimate_status: 'draft' | 'sent' | 'approved' | 'rejected' | 'revised'
// GHL opportunity status: 'open' | 'won' | 'lost'

export const LUNA_PROJECT_STATUS_TO_GHL: Record<string, string> = {
  lead: 'open',
  bid: 'open',
  active: 'open',
  completed: 'won',
  cancelled: 'lost',
};

export const GHL_STATUS_TO_LUNA_PROJECT: Record<string, string> = {
  open: 'active',
  won: 'completed',
  lost: 'cancelled',
  abandoned: 'cancelled',
};

export const LUNA_ESTIMATE_STATUS_TO_GHL: Record<string, string> = {
  draft: 'open',
  sent: 'open',
  approved: 'won',
  rejected: 'lost',
  revised: 'open',
};

export function mapLunaProjectStatusToGhl(status: string): 'open' | 'won' | 'lost' {
  return (LUNA_PROJECT_STATUS_TO_GHL[status] ?? 'open') as 'open' | 'won' | 'lost';
}

export function mapLunaEstimateStatusToGhl(status: string): 'open' | 'won' | 'lost' {
  return (LUNA_ESTIMATE_STATUS_TO_GHL[status] ?? 'open') as 'open' | 'won' | 'lost';
}

export function mapGhlStatusToLuna(status: string): string {
  return GHL_STATUS_TO_LUNA_PROJECT[status] ?? 'active';
}

// ─── Transform Helpers ───────────────────────────────────────────────────────

/**
 * Transform a Luna customer record into a GHL CreateContact request.
 */
export function lunaCustomerToGhlContact(
  customer: Record<string, unknown>,
  locationId: string
): CreateContactRequest {
  return {
    firstName: (customer.first_name as string) || '',
    lastName: (customer.last_name as string) || '',
    email: customer.email as string | undefined,
    phone1: customer.phone as string | undefined,
    companyName: customer.company_name as string | undefined,
    address1: customer.address_line1 as string | undefined,
    city: customer.city as string | undefined,
    state: customer.state as string | undefined,
    postalCode: customer.postal_code as string | undefined,
    country: customer.country as string | undefined,
    locationId,
  };
}

/**
 * Transform a GHL Contact into a Luna customer upsert record.
 */
export function ghlContactToLunaCustomer(ghl: GHLContact): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ghl_contact_id: ghl.id,
    updated_at: new Date().toISOString(),
  };
  if (ghl.email) result['email'] = ghl.email;
  if (ghl.firstName) result['first_name'] = ghl.firstName;
  if (ghl.lastName) result['last_name'] = ghl.lastName;
  if (ghl.phone1 || ghl.phone) result['phone'] = ghl.phone1 ?? ghl.phone;
  if (ghl.companyName) result['company_name'] = ghl.companyName;
  if (ghl.address1) result['address_line1'] = ghl.address1;
  if (ghl.city) result['city'] = ghl.city;
  if (ghl.state) result['state'] = ghl.state;
  if (ghl.postalCode) result['postal_code'] = ghl.postalCode;
  if (ghl.country) result['country'] = ghl.country;
  return result;
}

/**
 * Transform Luna project + optional estimate into a GHL CreateOpportunity request.
 */
export function lunaProjectToGhlOpportunity(
  project: Record<string, unknown>,
  estimate: Record<string, unknown> | null,
  locationId: string,
  pipelineId: string,
  pipelineStageId: string,
  contactId: string
): CreateOpportunityRequest {
  const monetaryValue =
    typeof estimate?.total === 'number'
      ? estimate.total
      : typeof project.estimated_value === 'number'
      ? project.estimated_value
      : 0;

  const status = estimate
    ? mapLunaEstimateStatusToGhl(estimate.status as string)
    : mapLunaProjectStatusToGhl(project.status as string);

  return {
    name: (project.name as string) ?? `Project #${project.id}`,
    locationId,
    pipelineId,
    pipelineStageId,
    contactId,
    maxVal: monetaryValue,
    monetaryValue,
    status,
    source: 'Luna Estimator',
  };
}

/**
 * Transform Luna project update into a GHL UpdateOpportunity request.
 */
export function lunaProjectToGhlOpportunityUpdate(
  project: Record<string, unknown>,
  estimate: Record<string, unknown> | null
): UpdateOpportunityRequest {
  const monetaryValue =
    typeof estimate?.total === 'number'
      ? estimate.total
      : typeof project.estimated_value === 'number'
      ? project.estimated_value
      : undefined;

  const status = estimate
    ? mapLunaEstimateStatusToGhl(estimate.status as string)
    : mapLunaProjectStatusToGhl(project.status as string);

  return {
    id: project.ghl_opportunity_id as string,
    name: project.name as string | undefined,
    maxVal: monetaryValue,
    monetaryValue,
    status,
  };
}

/**
 * Build a GHL Note body from a Luna estimate and its line items.
 */
export function lunaEstimateToGhlNoteBody(
  estimate: Record<string, unknown>,
  lineItems: Array<Record<string, unknown>>
): string {
  const status = (estimate.status as string) ?? 'draft';
  const lines: string[] = [
    `📋 Estimate #${estimate.id}`,
    `Status: ${status}`,
    `Total: $${estimate.total ?? 0}`,
    '',
    '📦 Line Items:',
  ];

  if (lineItems.length === 0) {
    lines.push('  (no line items)');
  } else {
    for (const item of lineItems) {
      const qty = item.quantity ?? 1;
      const unitPrice = item.unit_price ?? item.total ?? 0;
      lines.push(`  • ${item.name ?? 'Item'}: $${unitPrice} × ${qty} = $${item.total ?? unitPrice * qty}`);
    }
  }

  if (estimate.notes) {
    lines.push('', `📝 Notes: ${estimate.notes}`);
  }

  return lines.join('\n');
}
