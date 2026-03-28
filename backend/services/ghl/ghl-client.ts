// ─── GHL API v2 Client ────────────────────────────────────────────────────────

import type {
  GHLContact,
  GHLOpportunity,
  GHLPipeline,
  GHLPipelineStage,
  GHLNote,
  GHLTag,
  GHLListResponse,
  CreateContactRequest,
  UpdateContactRequest,
  SearchContactsRequest,
  CreateOpportunityRequest,
  UpdateOpportunityRequest,
  MoveOpportunityStageRequest,
  AddNoteRequest,
  AddTagRequest,
} from './ghl-types';

const BASE_URL = 'https://services.leadconnectorhq.com';

export class GHLClient {
  private accessToken: string;
  private locationId: string;
  private rateLimitDelayMs = 600; // 100 req/min → 600ms between calls

  constructor(accessToken: string, locationId: string) {
    this.accessToken = accessToken;
    this.locationId = locationId;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    };

    const opts: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET' && method !== 'DELETE') {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url.toString(), opts);

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
      await this.sleep(retryAfter * 1000);
      return this.request(method, path, body, params);
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new GHLApiError(res.status, error.message ?? res.statusText, error.code);
    }

    // DELETE returns 204 No Content
    if (res.status === 204) return {} as T;

    return res.json() as Promise<T>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    await this.sleep(this.rateLimitDelayMs);
    return fn();
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  async getContacts(query?: SearchContactsRequest): Promise<GHLListResponse<GHLContact>> {
    const params: Record<string, string> = {
      location_id: query?.locationId ?? this.locationId,
    };
    if (query?.email) params['email'] = query.email;
    if (query?.phone) params['phone'] = query.phone;
    if (query?.name) params['name'] = query.name;
    if (query?.limit) params['limit'] = String(query.limit);
    if (query?.skip) params['skip'] = String(query.skip);

    return this.withRateLimit(() =>
      this.request<GHLListResponse<GHLContact>>('GET', '/contacts/', undefined, params)
    );
  }

  async getContact(id: string): Promise<GHLContact> {
    return this.withRateLimit(() =>
      this.request<GHLContact>('GET', `/contacts/${id}`)
    );
  }

  async createContact(data: CreateContactRequest): Promise<GHLContact> {
    return this.withRateLimit(() =>
      this.request<GHLContact>('POST', '/contacts/', data)
    );
  }

  async updateContact(id: string, data: Partial<CreateContactRequest>): Promise<GHLContact> {
    return this.withRateLimit(() =>
      this.request<GHLContact>('PUT', `/contacts/${id}`, { ...data, id })
    );
  }

  async deleteContact(id: string): Promise<void> {
    await this.withRateLimit(() =>
      this.request<void>('DELETE', `/contacts/${id}`)
    );
  }

  async searchContactsByEmail(email: string): Promise<GHLListResponse<GHLContact>> {
    return this.getContacts({ locationId: this.locationId, email, limit: 5 });
  }

  async searchContactsByPhone(phone: string): Promise<GHLListResponse<GHLContact>> {
    return this.getContacts({ locationId: this.locationId, phone, limit: 5 });
  }

  // ─── Tags ─────────────────────────────────────────────────────────────────

  async addTag(contactId: string, tag: string): Promise<void> {
    await this.withRateLimit(() =>
      this.request<void>('POST', `/contacts/${contactId}/tags`, { tag })
    );
  }

  async removeTag(contactId: string, tag: string): Promise<void> {
    await this.withRateLimit(() =>
      this.request<void>('DELETE', `/contacts/${contactId}/tags/${encodeURIComponent(tag)}`)
    );
  }

  async getTags(): Promise<GHLListResponse<GHLTag>> {
    return this.withRateLimit(() =>
      this.request<GHLListResponse<GHLTag>>('GET', '/tags/', {
        location_id: this.locationId,
      })
    );
  }

  // ─── Notes ───────────────────────────────────────────────────────────────

  async addNoteToContact(contactId: string, data: AddNoteRequest): Promise<GHLNote> {
    return this.withRateLimit(() =>
      this.request<GHLNote>('POST', `/contacts/${contactId}/notes`, data)
    );
  }

  async addNoteToOpportunity(opportunityId: string, data: AddNoteRequest): Promise<GHLNote> {
    return this.withRateLimit(() =>
      this.request<GHLNote>('POST', `/opportunities/${opportunityId}/notes`, data)
    );
  }

  // ─── Opportunities ────────────────────────────────────────────────────────

  async getOpportunities(pipelineId?: string): Promise<GHLListResponse<GHLOpportunity>> {
    const params: Record<string, string> = { location_id: this.locationId };
    if (pipelineId) params['pipeline_id'] = pipelineId;

    return this.withRateLimit(() =>
      this.request<GHLListResponse<GHLOpportunity>>('GET', '/opportunities/', undefined, params)
    );
  }

  async getOpportunity(id: string): Promise<GHLOpportunity> {
    return this.withRateLimit(() =>
      this.request<GHLOpportunity>('GET', `/opportunities/${id}`)
    );
  }

  async createOpportunity(data: CreateOpportunityRequest): Promise<GHLOpportunity> {
    return this.withRateLimit(() =>
      this.request<GHLOpportunity>('POST', '/opportunities/', data)
    );
  }

  async updateOpportunity(id: string, data: UpdateOpportunityRequest): Promise<GHLOpportunity> {
    return this.withRateLimit(() =>
      this.request<GHLOpportunity>('PUT', `/opportunities/${id}`, { ...data, id })
    );
  }

  async updateOpportunityStage(
    id: string,
    pipelineStageId: string
  ): Promise<GHLOpportunity> {
    return this.withRateLimit(() =>
      this.request<GHLOpportunity>(
        'PUT',
        `/opportunities/${id}/move`,
        { pipelineStageId } as MoveOpportunityStageRequest
      )
    );
  }

  async deleteOpportunity(id: string): Promise<void> {
    await this.withRateLimit(() =>
      this.request<void>('DELETE', `/opportunities/${id}`)
    );
  }

  // ─── Pipelines ───────────────────────────────────────────────────────────

  async getPipelines(): Promise<GHLListResponse<GHLPipeline>> {
    return this.withRateLimit(() =>
      this.request<GHLListResponse<GHLPipeline>>('GET', '/pipelines/', {
        location_id: this.locationId,
      })
    );
  }

  async getPipelineStages(pipelineId: string): Promise<GHLListResponse<GHLPipelineStage>> {
    return this.withRateLimit(() =>
      this.request<GHLListResponse<GHLPipelineStage>>(
        'GET',
        `/pipelines/${pipelineId}/pipelinestages/`
      )
    );
  }

  // ─── Token Update ─────────────────────────────────────────────────────────

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setLocationId(locationId: string): void {
    this.locationId = locationId;
  }
}

// ─── Custom Error ────────────────────────────────────────────────────────────

export class GHLApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'GHLApiError';
  }
}
