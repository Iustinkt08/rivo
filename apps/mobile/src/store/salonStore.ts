import { create } from 'zustand';

export interface SalonCard {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  city: string;
  addressLine1: string;
  averageRating: number;
  reviewCount: number;
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
}

export interface OpeningHour {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface SalonProfile extends SalonCard {
  description?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  latitude: number;
  longitude: number;
  requiresDeposit: boolean;
  depositPercentage?: number | null;
  cancellationHours: number;
  openingHours: OpeningHour[];
  gallery: { id: string; url: string; caption?: string | null }[];
  serviceCount: number;
  staffCount: number;
}

interface SalonState {
  salons: SalonCard[];
  selectedSalon: SalonProfile | null;
  isLoading: boolean;
  setSalons: (s: SalonCard[]) => void;
  setSelectedSalon: (s: SalonProfile | null) => void;
  setLoading: (v: boolean) => void;
}

export const useSalonStore = create<SalonState>((set) => ({
  salons: [],
  selectedSalon: null,
  isLoading: false,
  setSalons: (salons) => set({ salons }),
  setSelectedSalon: (selectedSalon) => set({ selectedSalon }),
  setLoading: (isLoading) => set({ isLoading }),
}));
