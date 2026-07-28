import { api } from './client';

/**
 * A service category from the shared backend Category table — the single source
 * of truth for both the Client and Business apps. Served by GET /categories.
 */
export interface ServiceCategory {
  id: string;
  name: string;
  iconUrl: string | null;
  sortOrder: number;
}

export const categoriesApi = {
  /** All service categories, ordered by sortOrder. */
  async list(): Promise<ServiceCategory[]> {
    const { data } = await api.get('/categories');
    const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    return list
      .map((c) => ({
        id: c.id,
        name: c.name,
        iconUrl: c.iconUrl ?? null,
        sortOrder: Number(c.sortOrder ?? 0),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
};
