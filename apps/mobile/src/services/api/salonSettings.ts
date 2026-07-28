import { api } from './client';
import { BusinessService, SalonProfile } from '../../store/businessStore';

// New salon-settings API wrappers (F3). Lives beside business.ts on purpose:
// business.ts is owned by another package, so additions land here.

/** Maps a raw backend service (incl. staffServices join rows) to the UI shape. */
function mapService(data: any): BusinessService {
  return {
    id: data.id,
    name: data.name,
    categoryId: data.categoryId ?? data.category?.id,
    category: data.category?.name ?? '',
    durationMin: data.durationMin,
    price: Number(data.price),
    isActive: data.isActive,
    staffIds: (data.staffServices ?? []).map((s: any) => s.staffId),
  };
}

export interface ServicePayload {
  name: string;
  categoryId: string;
  durationMin: number;
  price: number;
  isActive: boolean;
  /** Staff who perform this service — replaces assignments server-side. */
  staffIds: string[];
}

export const salonSettingsApi = {
  // ── Services (with staff assignments) ───────────────────────────────────────

  async getServices(salonId: string): Promise<BusinessService[]> {
    const { data } = await api.get(`/salons/${salonId}/services`);
    const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    return list.map(mapService);
  },

  async createService(salonId: string, dto: ServicePayload): Promise<BusinessService> {
    const { data } = await api.post(`/salons/${salonId}/services`, dto);
    return mapService(data);
  },

  async updateService(
    salonId: string,
    serviceId: string,
    dto: Partial<ServicePayload>,
  ): Promise<BusinessService> {
    const { data } = await api.patch(`/salons/${salonId}/services/${serviceId}`, dto);
    return mapService(data);
  },

  // ── Salon logo ──────────────────────────────────────────────────────────────

  /** Persists the salon logo URL (or removes it with null). */
  async updateSalonLogo(salonId: string, logoUrl: string | null): Promise<SalonProfile['logoUrl']> {
    const { data } = await api.patch(`/salons/${salonId}`, { logoUrl });
    return data.logoUrl ?? null;
  },
};
