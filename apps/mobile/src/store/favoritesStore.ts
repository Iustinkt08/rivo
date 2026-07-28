import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SalonCard } from './salonStore';

interface FavoritesStore {
  favorites: SalonCard[];
  addFavorite: (salon: SalonCard) => void;
  removeFavorite: (salonId: string) => void;
  isFavorite: (salonId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (salon) => {
        if (get().favorites.some((f) => f.id === salon.id)) return;
        set((s) => ({ favorites: [salon, ...s.favorites] }));
      },

      removeFavorite: (salonId) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== salonId) })),

      isFavorite: (salonId) => get().favorites.some((f) => f.id === salonId),
    }),
    {
      name: 'navira-favorites',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
