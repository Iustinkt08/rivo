import { api } from './client';
import {
  AvailableSlot,
  RawAvailabilitySlot,
  mapAvailabilitySlots,
} from '../../utils/bookingSlots';
import {
  NoStaffAvailableError,
  isNoStaffResponse,
} from '../../utils/bookingErrors';

export type { AvailableSlot };
export { NoStaffAvailableError };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookingService {
  id: string;
  name: string;
  category: string;
  durationMin: number;
  price: number;
}

export interface BookingStaff {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  avatarEmoji: string;
  /** Ids of the services this member performs (StaffService links). */
  serviceIds: string[];
}

export interface SlotLockResult {
  expiresAt: string; // ISO — computed from the backend's expiresIn (seconds)
}

export interface SlotRef {
  serviceId: string;
  staffId: string;
  startAt: string; // exact ISO from the availability slot
}

export interface CreateBookingResult {
  bookingId: string;
  status: string;
}

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface MyAppointment {
  id: string;
  salonId: string;
  salonName: string;
  salonSlug: string;
  serviceId: string;
  serviceName: string;
  staffName: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  durationMin: number;
  price: number;
  status: AppointmentStatus;
  hasReview: boolean;
  notes?: string;
}

// ── Mapping ───────────────────────────────────────────────────────────────────
// One server appointment (GET /appointments/me item or GET /appointments/:id)
// → the MyAppointment shape used by the client screens.

function mapServerAppointment(a: any): MyAppointment {
  const startAt = new Date(a.startAt);
  return {
    id: a.id,
    salonId: a.salon?.id ?? a.salonId ?? '',
    salonName: a.salon?.name ?? '',
    salonSlug: a.salon?.slug ?? '',
    serviceId: a.service?.id ?? a.serviceId ?? '',
    serviceName: a.service?.name ?? '',
    staffName: a.staff ? `${a.staff.firstName ?? ''} ${a.staff.lastName ?? ''}`.trim() : 'Orice specialist',
    date: startAt.toISOString().split('T')[0],
    time: startAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
    durationMin: a.service?.durationMin ?? 0,
    price: Number(a.priceSnapshot ?? a.service?.price ?? 0),
    status: a.status,
    hasReview: Boolean(a.review) || (a.hasReview ?? false),
    notes: a.clientNotes ?? undefined,
  };
}

// ── Session id (slot-lock ownership) ──────────────────────────────────────────
// One id per app session: the backend uses it to pair lock/release/create.

let bookingSessionId: string | null = null;

export function getBookingSessionId(): string {
  if (!bookingSessionId) {
    bookingSessionId = `bk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return bookingSessionId;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const bookingsApi = {

  async getServices(salonId: string): Promise<BookingService[]> {
    const { data } = await api.get(`/salons/${salonId}/services`);
    return (data.data ?? data).map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category?.name ?? s.category ?? '',
      durationMin: s.durationMin,
      price: Number(s.price),
    }));
  },

  async getStaff(salonId: string): Promise<BookingStaff[]> {
    const { data } = await api.get(`/salons/${salonId}/staff`);
    return (data.data ?? data).map((s: any) => ({
      id: s.id,
      name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
      specialty: s.specialty ?? '',
      rating: Number(s.averageRating ?? 0),
      avatarEmoji: s.avatarEmoji ?? '👤',
      serviceIds: (s.staffServices ?? [])
        .map((ss: any) => ss.serviceId ?? ss.service?.id)
        .filter(Boolean),
    }));
  },

  async getAvailability(
    salonId: string,
    serviceId: string,
    staffId: string | null,
    date: string,
  ): Promise<AvailableSlot[]> {
    const params: Record<string, string> = { serviceId, date };
    if (staffId) params.staffId = staffId;
    try {
      const { data } = await api.get(`/salons/${salonId}/availability`, { params });
      const raw: RawAvailabilitySlot[] = Array.isArray(data) ? data : data?.data ?? [];
      return mapAvailabilitySlots(raw);
    } catch (err: any) {
      // "Salon has no bookable staff" deserves a distinct UI state, not a
      // generic "no hours on this day".
      if (isNoStaffResponse(err?.response?.status, err?.response?.data?.message)) {
        throw new NoStaffAvailableError();
      }
      throw err;
    }
  },

  async lockSlot(salonId: string, slot: SlotRef): Promise<SlotLockResult> {
    const { data } = await api.post(`/salons/${salonId}/slots/lock`, {
      serviceId: slot.serviceId,
      staffId: slot.staffId,
      startAt: slot.startAt,
      sessionId: getBookingSessionId(),
    });
    const expiresInSec = Number(data?.expiresIn ?? 300);
    return { expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString() };
  },

  async releaseSlot(salonId: string, slot: SlotRef): Promise<void> {
    await api.post(`/salons/${salonId}/slots/release`, {
      serviceId: slot.serviceId,
      staffId: slot.staffId,
      startAt: slot.startAt,
      sessionId: getBookingSessionId(),
    });
  },

  async createBooking(dto: {
    salonId: string;
    serviceId: string;
    staffId: string;
    startAt: string;      // exact ISO from the locked slot
    clientNotes?: string;
    /** Validated discount code — the server re-validates and applies it. */
    discountCode?: string;
  }): Promise<CreateBookingResult> {
    const { data } = await api.post('/appointments', {
      salonId: dto.salonId,
      serviceId: dto.serviceId,
      staffId: dto.staffId,
      startAt: dto.startAt,
      sessionId: getBookingSessionId(),
      clientNotes: dto.clientNotes,
      discountCode: dto.discountCode,
    });
    return {
      bookingId: data.id,
      status: data.status,
    };
  },

  async getMyAppointments(): Promise<MyAppointment[]> {
    const { data } = await api.get('/appointments/me');
    return (data.data ?? data).map(mapServerAppointment);
  },

  /** Live detail fetch — used when only an appointment id is known (e.g. a notification tap). */
  async getAppointmentById(id: string): Promise<MyAppointment> {
    const { data } = await api.get(`/appointments/${id}`);
    return mapServerAppointment(data.data ?? data);
  },

  async cancelAppointment(id: string): Promise<void> {
    await api.patch(`/appointments/${id}/status`, { status: 'CANCELLED' });
  },

  async submitReview(dto: {
    appointmentId: string;
    rating: number;
    comment?: string;
  }): Promise<void> {
    await api.post('/reviews', dto);
  },
};
