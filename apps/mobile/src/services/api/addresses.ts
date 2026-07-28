import { api } from './client';

export interface Address {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  county?: string | null;
  country: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
}

export interface CreateAddressDto {
  label: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  county?: string;
  country: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export const addressesApi = {
  async list(): Promise<Address[]> {
    try {
      const { data } = await api.get('/addresses');
      return Array.isArray(data) ? data : (data?.data ?? []);
    } catch {
      if (!__DEV__) throw new Error('Failed to load addresses');
      return [];
    }
  },

  async create(dto: CreateAddressDto): Promise<Address> {
    try {
      const { data } = await api.post('/addresses', dto);
      return data;
    } catch (err: any) {
      if (!__DEV__) throw err;
      // Dev fallback: return a local stub so the UI reflects the intent
      return {
        id: `local-${Date.now()}`,
        label: dto.label,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2 ?? null,
        city: dto.city,
        county: dto.county ?? null,
        country: dto.country,
        postalCode: dto.postalCode ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isDefault: dto.isDefault ?? false,
      };
    }
  },

  async update(id: string, dto: Partial<CreateAddressDto>): Promise<Address> {
    try {
      const { data } = await api.patch(`/addresses/${id}`, dto);
      return data;
    } catch (err: any) {
      if (!__DEV__) throw err;
      return {
        id,
        label: dto.label ?? '',
        addressLine1: dto.addressLine1 ?? '',
        addressLine2: dto.addressLine2 ?? null,
        city: dto.city ?? '',
        county: dto.county ?? null,
        country: dto.country ?? 'Romania',
        postalCode: dto.postalCode ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isDefault: dto.isDefault ?? false,
      };
    }
  },

  async remove(id: string): Promise<void> {
    try {
      await api.delete(`/addresses/${id}`);
    } catch (err: any) {
      if (!__DEV__) throw err;
      // Dev: silently ignore so the UI can remove it locally
    }
  },
};
