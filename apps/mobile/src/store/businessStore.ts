import { create } from 'zustand';
import { localDateKey } from '../utils/calendarLayout';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type BookingSource = 'ONLINE' | 'WALK_IN' | 'PHONE';

export interface SalonOpeningHour {
  dayOfWeek: string; // MONDAY … SUNDAY
  openTime: string;  // HH:MM
  closeTime: string; // HH:MM
  isClosed: boolean;
}

export interface GalleryPhoto {
  id: string;
  url: string;
  caption?: string | null;
}

export interface SalonProfile {
  id: string;
  name: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  addressLine1: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  requiresDeposit: boolean;
  depositPercentage?: number | null;
  cancellationHours: number;
  openingHours: SalonOpeningHour[];
  galleryPhotos?: GalleryPhoto[];
}

export interface BusinessAppointment {
  id: string;
  clientName: string;
  clientPhone?: string;
  serviceName: string;
  serviceDuration: number;
  servicePrice: number;
  staffName: string;
  staffId: string;
  startAt: string; // ISO
  endAt: string;
  status: AppointmentStatus;
  source: BookingSource;
  notes?: string;
}

export interface BusinessClient {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  totalVisits: number;
  noShowCount: number;
  lastVisitAt?: string;
  notes?: string;
  isBlocked: boolean;
}

export interface BusinessService {
  id: string;
  name: string;
  category: string;          // display name, used for grouping
  categoryId?: string;       // real backend Category id (source of truth)
  durationMin: number;
  price: number;
  isActive: boolean;
  /** Staff member ids who perform this service (StaffService join rows). */
  staffIds?: string[];
}

export interface BusinessStaff {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  avatarEmoji: string;
  isActive: boolean;
  username?: string | null; // set when the member has a staff login account
}

interface BusinessState {
  appointments: BusinessAppointment[];
  clients: BusinessClient[];
  services: BusinessService[];
  staff: BusinessStaff[];
  salonProfile: SalonProfile | null;
  selectedDate: string; // YYYY-MM-DD
  setAppointments: (a: BusinessAppointment[]) => void;
  addAppointment: (a: BusinessAppointment) => void;
  setClients: (c: BusinessClient[]) => void;
  updateClient: (c: BusinessClient) => void;
  setServices: (s: BusinessService[]) => void;
  addService: (s: BusinessService) => void;
  updateService: (s: BusinessService) => void;
  removeService: (id: string) => void;
  setStaff: (s: BusinessStaff[]) => void;
  addStaffMember: (s: BusinessStaff) => void;
  updateStaffMember: (s: BusinessStaff) => void;
  removeStaffMember: (id: string) => void;
  setSalonProfile: (s: SalonProfile | null) => void;
  setSelectedDate: (d: string) => void;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  replaceAppointment: (tempId: string, real: BusinessAppointment) => void;
}

// Local calendar day — UTC truncation would open yesterday after local midnight.
const today = localDateKey(new Date());

export const useBusinessStore = create<BusinessState>((set) => ({
  appointments: [],
  clients: [],
  services: [],
  staff: [],
  salonProfile: null,
  selectedDate: today,
  setAppointments: (appointments) => set({ appointments }),
  addAppointment: (a) => set((state) => ({ appointments: [...state.appointments, a] })),
  setClients: (clients) => set({ clients }),
  updateClient: (c) => set((state) => ({ clients: state.clients.map((x) => x.id === c.id ? c : x) })),
  setServices: (services) => set({ services }),
  addService: (s) => set((state) => ({ services: [...state.services, s] })),
  updateService: (s) => set((state) => ({ services: state.services.map((x) => x.id === s.id ? s : x) })),
  removeService: (id) => set((state) => ({ services: state.services.filter((s) => s.id !== id) })),
  setStaff: (staff) => set({ staff }),
  addStaffMember: (s) => set((state) => ({ staff: [...state.staff, s] })),
  updateStaffMember: (s) => set((state) => ({ staff: state.staff.map((x) => x.id === s.id ? s : x) })),
  removeStaffMember: (id) => set((state) => ({ staff: state.staff.filter((s) => s.id !== id) })),
  setSalonProfile: (salonProfile) => set({ salonProfile }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  updateAppointmentStatus: (id, status) =>
    set((state) => ({
      appointments: state.appointments.map((a) =>
        a.id === id ? { ...a, status } : a
      ),
    })),
  replaceAppointment: (tempId, real) =>
    set((state) => ({
      appointments: state.appointments.map((a) => a.id === tempId ? real : a),
    })),
}));
