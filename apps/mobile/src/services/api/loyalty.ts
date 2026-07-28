import { api } from './client';
import type { DiscountType } from './discounts';

// Loyalty punch cards API (F7). Business side: config + per-client progress.
// Client side: my punch cards across salons.

export interface PunchCardConfig {
  salonId: string;
  isActive: boolean;
  requiredVisits: number;
  rewardType: DiscountType;
  rewardValue: number;
}

export interface SavePunchCardPayload {
  isActive: boolean;
  requiredVisits: number;
  rewardType: DiscountType;
  rewardValue: number;
}

/** A client's progress at one salon — all fields computed server-side. */
export interface PunchProgress {
  active: boolean;
  requiredVisits: number | null;
  rewardType: DiscountType | null;
  rewardValue: number | null;
  completedVisits: number;
  earned: boolean;
}

/** One of my punch cards (client view). */
export interface MyPunchCard {
  salon: { id: string; name: string; logoUrl: string | null };
  requiredVisits: number;
  rewardType: DiscountType;
  rewardValue: number;
  completedVisits: number;
  earned: boolean;
}

function mapConfig(raw: any): PunchCardConfig {
  return {
    salonId: raw.salonId,
    isActive: Boolean(raw.isActive),
    requiredVisits: Number(raw.requiredVisits),
    rewardType: raw.rewardType,
    rewardValue: Number(raw.rewardValue),
  };
}

export const loyaltyApi = {
  /** Business: the salon's punch-card config, or null when never configured. */
  async getPunchCardConfig(salonId: string): Promise<PunchCardConfig | null> {
    const { data } = await api.get(`/salons/${salonId}/punch-card`);
    return data ? mapConfig(data) : null;
  },

  /** Business (owner): create or update the salon's punch-card config. */
  async savePunchCardConfig(
    salonId: string,
    payload: SavePunchCardPayload,
  ): Promise<PunchCardConfig> {
    const { data } = await api.put(`/salons/${salonId}/punch-card`, payload);
    return mapConfig(data);
  },

  /** Business: a client's punch progress at this salon. */
  async getClientPunchProgress(
    salonId: string,
    clientId: string,
  ): Promise<PunchProgress> {
    const { data } = await api.get(
      `/salons/${salonId}/punch-card/clients/${clientId}/progress`,
    );
    return {
      active: Boolean(data.active),
      requiredVisits: data.requiredVisits ?? null,
      rewardType: data.rewardType ?? null,
      rewardValue: data.rewardValue != null ? Number(data.rewardValue) : null,
      completedVisits: Number(data.completedVisits ?? 0),
      earned: Boolean(data.earned),
    };
  },

  /** Client: my punch cards at every salon with an active loyalty program. */
  async getMyPunchCards(): Promise<MyPunchCard[]> {
    const { data } = await api.get('/loyalty/punch-cards/me');
    const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    return list.map((raw) => ({
      salon: {
        id: raw.salon?.id ?? '',
        name: raw.salon?.name ?? '',
        logoUrl: raw.salon?.logoUrl ?? null,
      },
      requiredVisits: Number(raw.requiredVisits),
      rewardType: raw.rewardType,
      rewardValue: Number(raw.rewardValue),
      completedVisits: Number(raw.completedVisits ?? 0),
      earned: Boolean(raw.earned),
    }));
  },
};

/** Romanian reward sentence fragment, e.g. "20% reducere" / "25 RON reducere". */
export function formatPunchReward(
  rewardType: DiscountType | null,
  rewardValue: number | null,
): string {
  if (rewardType == null || rewardValue == null) return '';
  return rewardType === 'PERCENT'
    ? `${rewardValue}% reducere`
    : `${rewardValue} RON reducere`;
}
