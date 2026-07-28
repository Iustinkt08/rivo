import { api } from './client';
import {
  BusinessAppointment,
  BusinessClient,
  BusinessService,
  BusinessStaff,
  GalleryPhoto,
  SalonOpeningHour,
  SalonProfile,
} from '../../store/businessStore';
import { SalonReviewItem, mapSalonReviews, mapSalonReview } from '../../utils/reviewMapping';

export type { SalonReviewItem } from '../../utils/reviewMapping';

// ── Analytics types ───────────────────────────────────────────────────────────

export type AnalyticsRange = 'week' | 'month' | 'year' | 'custom';

export interface AnalyticsRow {
  id: string;
  name: string;
  count: number;
  revenue: number;
}

export interface AnalyticsBar {
  label: string;
  value: number;
}

export interface BusinessAnalytics {
  range: AnalyticsRange;
  from: string;
  to: string;
  revenue: number;
  appointmentCount: number;
  completedCount: number;
  bars: AnalyticsBar[];
  topServices: AnalyticsRow[];
  topStaff: AnalyticsRow[];
}

export interface AnalyticsQuery {
  range?: 'week' | 'month' | 'year';
  from?: string; // YYYY-MM-DD — custom range start (with `to`)
  to?: string; // YYYY-MM-DD — custom range end (with `from`)
}

// ── API calls ─────────────────────────────────────────────────────────────────

// Staff login credentials — the password is returned by the backend exactly
// once (at creation / reset) and is never retrievable again.
export interface StaffCredentials {
  username: string;
  password: string;
}

// Map a server appointment (with client/staff/service relations) to the local
// BusinessAppointment shape used by the calendar UI.
function mapServerAppointment(a: any): BusinessAppointment {
  const durationMin =
    a.service?.durationMin ??
    Math.max(1, Math.round((new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000));
  const fullName = [a.client?.firstName, a.client?.lastName].filter(Boolean).join(' ').trim();
  const staffName = [a.staff?.firstName, a.staff?.lastName].filter(Boolean).join(' ').trim();
  return {
    id: a.id,
    clientName: a.guestName ?? (fullName || 'Client'),
    clientPhone: a.guestPhone ?? a.client?.phone ?? undefined,
    serviceName: a.service?.name ?? '',
    serviceDuration: durationMin,
    servicePrice: Number(a.priceSnapshot ?? 0),
    staffId: a.staffId ?? a.staff?.id ?? '',
    staffName,
    startAt: a.startAt,
    endAt: a.endAt ?? new Date(new Date(a.startAt).getTime() + durationMin * 60000).toISOString(),
    status: a.status,
    source: a.source,
    notes: a.clientNotes ?? undefined,
  };
}

export const businessApi = {
  // Real salon appointments for a given day (YYYY-MM-DD). No mock fallback — the
  // calendar reflects actual data; an empty day renders the empty state.
  async getAppointments(salonId: string, date: string): Promise<BusinessAppointment[]> {
    const { data } = await api.get(`/salons/${salonId}/appointments`, { params: { date } });
    const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    return list.map(mapServerAppointment);
  },

  // Owner-facing reviews (includes hidden + reply state) for the manage screen.
  async getReviews(salonId: string): Promise<SalonReviewItem[]> {
    const { data } = await api.get(`/salons/${salonId}/reviews/manage`);
    return mapSalonReviews(data);
  },

  // Owner posts a public reply to one of their reviews.
  async replyToReview(reviewId: string, replyText: string): Promise<SalonReviewItem> {
    const { data } = await api.patch(`/reviews/${reviewId}/reply`, { replyText });
    return mapSalonReview(data?.data ?? data);
  },

  // Real clients for the salon, derived server-side from actual appointments.
  // No mock fallback — an empty result renders the empty state, errors surface.
  async getClients(salonId: string): Promise<BusinessClient[]> {
    const { data } = await api.get(`/salons/${salonId}/clients`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async updateClientNotes(salonId: string, clientId: string, notes: string): Promise<void> {
    await api.patch(`/salons/${salonId}/clients/${clientId}/notes`, { notes });
  },

  async toggleBlockClient(salonId: string, clientId: string): Promise<{ isBlocked: boolean }> {
    const { data } = await api.patch(`/salons/${salonId}/clients/${clientId}/block`);
    return data;
  },

  async getServices(salonId: string): Promise<BusinessService[]> {
    const { data } = await api.get(`/salons/${salonId}/services`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async getStaff(salonId: string): Promise<BusinessStaff[]> {
    const { data } = await api.get(`/salons/${salonId}/staff`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  // Owner-only listing that includes login usernames — the public /staff
  // endpoint intentionally hides them (they are login identifiers).
  async getStaffManage(salonId: string): Promise<BusinessStaff[]> {
    const { data } = await api.get(`/salons/${salonId}/staff/manage`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async updateAppointmentStatus(id: string, status: string): Promise<void> {
    // Propagate failures — the calendar reverts its optimistic update and
    // surfaces the server's message (e.g. time-gated complete/no-show → 400).
    await api.patch(`/appointments/${id}/status`, { status });
  },

  // Move an appointment to a new start time (and optionally another staff
  // member). Only PENDING/CONFIRMED are reschedulable server-side; failures
  // propagate so callers can revert optimistic moves (409 = slot taken).
  async rescheduleAppointment(
    id: string,
    startAtISO: string,
    staffId?: string,
  ): Promise<BusinessAppointment> {
    const { data } = await api.patch(`/appointments/${id}/reschedule`, {
      startAt: startAtISO,
      ...(staffId ? { staffId } : {}),
    });
    return mapServerAppointment(data);
  },

  // ── Analytics ─────────────────────────────────────────────────────────────────

  // Real salon analytics (revenue, counts, top services/staff) over a rolling
  // window. range: 'week' (7 daily buckets) | 'month' (4 weekly buckets).
  async getAnalytics(salonId: string, query: AnalyticsQuery = {}): Promise<BusinessAnalytics> {
    const params: Record<string, string> = {};
    if (query.from && query.to) {
      params.from = query.from;
      params.to = query.to;
    } else {
      params.range = query.range ?? 'week';
    }
    const { data } = await api.get(`/salons/${salonId}/analytics`, { params });
    const bars: AnalyticsBar[] = Array.isArray(data.bars)
      ? data.bars.map((b: any) =>
          typeof b === 'number'
            ? { label: '', value: Number(b) || 0 }
            : { label: String(b?.label ?? ''), value: Number(b?.value ?? 0) || 0 },
        )
      : [];
    return {
      range: data.range ?? query.range ?? 'custom',
      from: data.from ?? query.from ?? '',
      to: data.to ?? query.to ?? '',
      revenue: Number(data.revenue ?? 0),
      appointmentCount: Number(data.appointmentCount ?? 0),
      completedCount: Number(data.completedCount ?? 0),
      bars,
      topServices: (data.topServices ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        count: Number(r.count ?? 0),
        revenue: Number(r.revenue ?? 0),
      })),
      topStaff: (data.topStaff ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        count: Number(r.count ?? 0),
        revenue: Number(r.revenue ?? 0),
      })),
    };
  },

  // ── Services ────────────────────────────────────────────────────────────────

  async createService(
    salonId: string,
    dto: { name: string; categoryId: string; durationMin: number; price: number; isActive: boolean },
  ): Promise<BusinessService> {
    const { data } = await api.post(`/salons/${salonId}/services`, {
      categoryId: dto.categoryId,
      name: dto.name,
      durationMin: dto.durationMin,
      price: dto.price,
      isActive: dto.isActive,
    });
    return {
      id: data.id,
      name: data.name,
      categoryId: data.categoryId ?? data.category?.id,
      category: data.category?.name ?? '',
      durationMin: data.durationMin,
      price: Number(data.price),
      isActive: data.isActive,
    };
  },

  async updateService(salonId: string, serviceId: string, dto: Partial<BusinessService>): Promise<BusinessService> {
    const { data } = await api.patch(`/salons/${salonId}/services/${serviceId}`, {
      ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
      name: dto.name,
      durationMin: dto.durationMin,
      price: dto.price,
      isActive: dto.isActive,
    });
    return {
      id: data.id,
      name: data.name,
      categoryId: data.categoryId ?? data.category?.id ?? dto.categoryId,
      category: data.category?.name ?? dto.category ?? '',
      durationMin: data.durationMin,
      price: Number(data.price),
      isActive: data.isActive,
    };
  },

  async toggleService(salonId: string, serviceId: string): Promise<BusinessService> {
    const { data } = await api.patch(`/salons/${salonId}/services/${serviceId}/toggle`);
    return {
      id: data.id,
      name: data.name,
      category: data.category?.name ?? '',
      durationMin: data.durationMin,
      price: Number(data.price),
      isActive: data.isActive,
    };
  },

  async deleteService(salonId: string, serviceId: string): Promise<void> {
    await api.delete(`/salons/${salonId}/services/${serviceId}`);
  },

  // ── Salon profile ───────────────────────────────────────────────────────────

  async getSalonProfile(): Promise<SalonProfile> {
    try {
      const { data } = await api.get('/salons/my/salon');
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        phone: data.phone,
        email: data.email,
        websiteUrl: data.websiteUrl,
        logoUrl: data.logoUrl ?? null,
        addressLine1: data.addressLine1,
        city: data.city,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        requiresDeposit: data.requiresDeposit ?? false,
        depositPercentage: data.depositPercentage,
        cancellationHours: data.cancellationHours ?? 24,
        openingHours: (data.openingHours ?? []).map((h: any) => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed ?? false,
        })),
        galleryPhotos: (data.gallery ?? []).map((p: any) => ({
          id: p.id,
          url: p.url,
          caption: p.caption ?? null,
        })),
      };
    } catch (err) {
      // No mock fallback. Surfacing the real error lets the business UI show a
      // proper "no salon yet / onboarding" state instead of a fake "Salon Demo".
      throw err;
    }
  },

  async updateSalonProfile(
    salonId: string,
    dto: Partial<Pick<SalonProfile, 'name' | 'description' | 'phone' | 'email' | 'websiteUrl' | 'addressLine1' | 'city' | 'requiresDeposit' | 'depositPercentage' | 'cancellationHours'>>,
  ): Promise<SalonProfile> {
    const { data } = await api.patch(`/salons/${salonId}`, dto);
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      phone: data.phone,
      email: data.email,
      websiteUrl: data.websiteUrl,
      addressLine1: data.addressLine1,
      city: data.city,
      requiresDeposit: data.requiresDeposit ?? false,
      depositPercentage: data.depositPercentage,
      cancellationHours: data.cancellationHours ?? 24,
      openingHours: [],
    };
  },

  async setOpeningHours(salonId: string, hours: SalonOpeningHour[]): Promise<void> {
    await api.post(`/salons/${salonId}/opening-hours`, { hours });
  },

  // ── Staff CRUD ──────────────────────────────────────────────────────────────

  async createStaffMember(salonId: string, dto: {
    firstName: string; lastName: string; specialty: string; avatarEmoji: string;
    username?: string;
  }): Promise<{ staff: BusinessStaff; credentials?: StaffCredentials }> {
    const { data } = await api.post(`/salons/${salonId}/staff`, dto);
    return {
      staff: {
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        specialty: data.specialty ?? '',
        avatarEmoji: data.avatarEmoji ?? '👤',
        isActive: data.isActive ?? true,
        username: data.username ?? null,
      },
      // Present only when a login account was created — password shown ONCE.
      credentials: data.credentials?.username
        ? { username: data.credentials.username, password: data.credentials.password }
        : undefined,
    };
  },

  // ── Staff login credentials (owner only; password returned exactly once) ────

  async createStaffCredentials(
    salonId: string,
    staffId: string,
    username: string,
    password?: string,
  ): Promise<StaffCredentials> {
    const { data } = await api.post(
      `/salons/${salonId}/staff/${staffId}/credentials`,
      { username, ...(password ? { password } : {}) },
    );
    return { username: data.username, password: data.password };
  },

  async resetStaffCredentials(
    salonId: string,
    staffId: string,
  ): Promise<StaffCredentials> {
    const { data } = await api.patch(
      `/salons/${salonId}/staff/${staffId}/credentials`,
      {},
    );
    return { username: data.username, password: data.password };
  },

  async updateStaffMember(salonId: string, staffId: string, dto: Partial<{
    firstName: string; lastName: string; specialty: string; avatarEmoji: string; isActive: boolean;
  }>): Promise<BusinessStaff> {
    const { data } = await api.patch(`/salons/${salonId}/staff/${staffId}`, dto);
    return {
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      specialty: data.specialty ?? '',
      avatarEmoji: data.avatarEmoji ?? '👤',
      isActive: data.isActive ?? true,
      username: data.username ?? null,
    };
  },

  async deleteStaffMember(salonId: string, staffId: string): Promise<void> {
    await api.delete(`/salons/${salonId}/staff/${staffId}`);
  },

  // ── Gallery photos ───────────────────────────────────────────────────────────

  async addGalleryPhoto(salonId: string, url: string, caption?: string): Promise<GalleryPhoto> {
    const { data } = await api.post(`/salons/${salonId}/photos`, { url, caption });
    return { id: data.id, url: data.url, caption: data.caption ?? null };
  },

  async deleteGalleryPhoto(salonId: string, photoId: string): Promise<void> {
    await api.delete(`/salons/${salonId}/photos/${photoId}`);
  },

  // ── Walk-in ─────────────────────────────────────────────────────────────────

  async createWalkIn(dto: {
    salonId: string;
    serviceId: string;
    staffId: string;
    startAt: string;
    guestName: string;
    guestPhone?: string;
    // pre-resolved display fields used for the mock fallback
    serviceName?: string;
    serviceDuration?: number;
    servicePrice?: number;
    staffName?: string;
  }): Promise<BusinessAppointment> {
    try {
      const { data } = await api.post('/appointments', {
        salonId: dto.salonId,
        serviceId: dto.serviceId,
        staffId: dto.staffId,
        startAt: dto.startAt,
        source: 'WALK_IN',
        guestName: dto.guestName,
        guestPhone: dto.guestPhone,
      });
      const durationMin = data.service?.durationMin ?? dto.serviceDuration ?? 30;
      return {
        id: data.id,
        clientName: data.guestName ?? data.client?.firstName ?? dto.guestName,
        clientPhone: data.guestPhone ?? data.client?.phone ?? dto.guestPhone,
        serviceName: data.service?.name ?? dto.serviceName ?? '',
        serviceDuration: durationMin,
        servicePrice: Number(data.priceSnapshot ?? dto.servicePrice ?? 0),
        staffName: (`${data.staff?.firstName ?? ''} ${data.staff?.lastName ?? ''}`.trim() || dto.staffName) ?? '',
        staffId: data.staffId ?? dto.staffId,
        startAt: data.startAt ?? dto.startAt,
        endAt: data.endAt ?? new Date(new Date(dto.startAt).getTime() + durationMin * 60000).toISOString(),
        status: data.status ?? 'CONFIRMED',
        source: 'WALK_IN',
      };
    } catch (err) {
      // No mock fallback — surface the error to the walk-in modal.
      throw err;
    }
  },

  // ── Notifications ───────────────────────────────────────────────────────────
  // List/read/read-all live in services/api/notifications.ts (shared with the
  // client app); only push-token registration is business-specific here.

  async registerPushToken(token: string, platform: string): Promise<void> {
    await api.post('/push-tokens', { token, platform });
  },
};
