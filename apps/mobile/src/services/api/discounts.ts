import { api } from './client';

// Discount codes API (F6). Client side: validate at checkout.
// Business side: full CRUD for the codes list + wizard.

export type DiscountType = 'PERCENT' | 'FIXED';

/** Server-validated discount — amounts are ALWAYS computed server-side. */
export interface ValidatedDiscount {
  valid: true;
  code: string;
  type: DiscountType;
  value: number;
  discountAmount: number;
  finalPrice: number;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  validFrom: string | null;   // ISO
  validUntil: string | null;  // ISO
  maxRedemptions: number | null;
  maxPerClient: number;
  isActive: boolean;
  redemptionCount: number;
  createdAt: string;
}

export interface CreateDiscountCodePayload {
  /** Omit to let the server generate a readable unique code (XXXX-XXXX). */
  code?: string;
  type: DiscountType;
  value: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  maxPerClient?: number;
}

export interface UpdateDiscountCodePayload {
  isActive?: boolean;
  validUntil?: string;
  maxRedemptions?: number;
  maxPerClient?: number;
}

function mapCode(raw: any): DiscountCode {
  return {
    id: raw.id,
    code: raw.code,
    type: raw.type,
    value: Number(raw.value),
    validFrom: raw.validFrom ?? null,
    validUntil: raw.validUntil ?? null,
    maxRedemptions: raw.maxRedemptions ?? null,
    maxPerClient: raw.maxPerClient ?? 1,
    isActive: Boolean(raw.isActive),
    redemptionCount: Number(raw.redemptionCount ?? 0),
    createdAt: raw.createdAt ?? '',
  };
}

/**
 * The backend sends Romanian, user-showable messages for discount errors —
 * surface them verbatim, falling back to a generic message.
 */
export function discountErrorMessage(err: any, fallback: string): string {
  const msg = err?.response?.data?.message;
  if (typeof msg === 'string' && msg.length > 0) return msg;
  if (Array.isArray(msg) && msg.length > 0) return String(msg[0]);
  return fallback;
}

export const discountsApi = {
  /** Checkout: validate a code for a service — server computes the amounts. */
  async validate(
    salonId: string,
    code: string,
    serviceId: string,
  ): Promise<ValidatedDiscount> {
    const { data } = await api.post(
      `/salons/${salonId}/discount-codes/validate`,
      { code: code.trim(), serviceId },
    );
    return {
      valid: true,
      code: data.code,
      type: data.type,
      value: Number(data.value),
      discountAmount: Number(data.discountAmount),
      finalPrice: Number(data.finalPrice),
    };
  },

  // ── Business (owner-only) ───────────────────────────────────────────────────

  async list(salonId: string): Promise<DiscountCode[]> {
    const { data } = await api.get(`/salons/${salonId}/discount-codes`);
    const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    return list.map(mapCode);
  },

  async create(
    salonId: string,
    payload: CreateDiscountCodePayload,
  ): Promise<DiscountCode> {
    const { data } = await api.post(`/salons/${salonId}/discount-codes`, payload);
    return mapCode(data);
  },

  async update(
    salonId: string,
    id: string,
    patch: UpdateDiscountCodePayload,
  ): Promise<DiscountCode> {
    const { data } = await api.patch(
      `/salons/${salonId}/discount-codes/${id}`,
      patch,
    );
    return mapCode(data);
  },

  /** Hard-deletes unused codes; retires (deactivates) redeemed ones. */
  async remove(
    salonId: string,
    id: string,
  ): Promise<'deleted' | 'retired'> {
    const { data } = await api.delete(`/salons/${salonId}/discount-codes/${id}`);
    return data?.result === 'retired' ? 'retired' : 'deleted';
  },
};
