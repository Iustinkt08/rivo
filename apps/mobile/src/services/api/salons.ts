import { api } from './client';
import { SalonCard, SalonProfile } from '../../store/salonStore';
import { SalonReviewItem, mapSalonReviews } from '../../utils/reviewMapping';

export type { SalonReviewItem } from '../../utils/reviewMapping';

// ── Real API calls ─────────────────────────────────────────────────────────
export const salonsApi = {
  async list(params?: {
    lat?: number;
    lng?: number;
    search?: string;
    category?: string;
  }): Promise<SalonCard[]> {
    const { data } = await api.get('/salons', { params });
    return data.data ?? [];
  },

  /**
   * Like list(), but if the geo-filtered search (10 km radius on the backend)
   * returns nothing, retries without coordinates so the home screen still
   * shows available salons instead of an empty state.
   */
  async listSmart(params?: {
    lat?: number;
    lng?: number;
    search?: string;
    category?: string;
  }): Promise<SalonCard[]> {
    const results = await this.list(params);
    if (results.length > 0 || params?.lat === undefined) return results;
    const { lat, lng, ...rest } = params;
    return this.list(rest);
  },

  async getProfile(slug: string): Promise<SalonProfile> {
    const { data } = await api.get(`/salons/${slug}`);
    return data;
  },

  async getServices(salonId: string): Promise<SalonServiceItem[]> {
    try {
      const { data } = await api.get(`/salons/${salonId}/services`);
      return Array.isArray(data) ? data : data?.data ?? [];
    } catch {
      return [];
    }
  },

  async getStaff(salonId: string): Promise<SalonStaffMember[]> {
    try {
      const { data } = await api.get(`/salons/${salonId}/staff`);
      return Array.isArray(data) ? data : data?.data ?? [];
    } catch {
      return [];
    }
  },

  /** Public salon reviews with per-review staff attribution. */
  async getReviews(salonId: string): Promise<SalonReviewItem[]> {
    const { data } = await api.get(`/salons/${salonId}/reviews`);
    return mapSalonReviews(data);
  },
};

export interface SalonServiceItem {
  id: string;
  name: string;
  description?: string | null;
  durationMin: number;
  price: number | string; // Prisma Decimal serializes as string
  currency?: string;
}

export interface SalonStaffMember {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  bio?: string | null;
}
