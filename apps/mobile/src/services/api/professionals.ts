import { api } from './client';
import {
  EditableStaffProfile,
  ProfessionalProfile,
  ProfessionalSearchResult,
  ProfessionalSocialKey,
  StaffVisibilitySettings,
  mapEditableStaffProfile,
  mapProfessionalProfile,
  mapProfessionalSearchResults,
} from '../../utils/professionalMapping';

export type {
  EditableStaffProfile,
  ProfessionalGalleryCategory,
  ProfessionalGalleryPhoto,
  ProfessionalProfile,
  ProfessionalReview,
  ProfessionalService,
  ProfessionalSearchResult,
  ProfessionalSocials,
  StaffVisibilitySettings,
} from '../../utils/professionalMapping';

/**
 * PATCH body for the staff self-service profile endpoint. Socials accept a
 * full https:// URL or a bare handle — the backend normalizes handles to
 * full URLs. Empty strings clear the stored value.
 */
export interface UpdateStaffProfilePayload {
  firstName?: string;
  lastName?: string;
  specialty?: string;
  bio?: string;
  phone?: string;
  email?: string;
  avatarEmoji?: string;
  socials?: Partial<Record<ProfessionalSocialKey, string>>;
  publicSettings?: Partial<StaffVisibilitySettings>;
}

/**
 * A staff member ranked among the "top professionals" across all salons,
 * ordered by number of appointments (desc). Served by GET /professionals/top.
 */
export interface TopProfessional {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  salonId: string;
  salonName: string | null;
  /** null when the professional hides their count (publicSettings gate). */
  appointmentCount: number | null;
}

export const professionalsApi = {
  /** Best professionals (real staff), ordered by appointment count. */
  async getTop(limit = 10): Promise<TopProfessional[]> {
    const { data } = await api.get('/professionals/top', { params: { limit } });
    const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    return list.map((p) => ({
      id: p.id,
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      fullName: p.fullName ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
      avatarUrl: p.avatarUrl ?? null,
      bio: p.bio ?? null,
      salonId: p.salonId,
      salonName: p.salonName ?? null,
      appointmentCount:
        p.appointmentCount == null ? null : Number(p.appointmentCount),
    }));
  },

  /** Full public profile for one professional (services, rating, reviews). */
  async getProfile(id: string): Promise<ProfessionalProfile> {
    const { data } = await api.get(`/professionals/${id}`);
    return mapProfessionalProfile(data?.data ?? data);
  },

  /** Public professional search by name or specialty. */
  async search(term: string, limit = 20): Promise<ProfessionalSearchResult[]> {
    const { data } = await api.get('/professionals', {
      params: { search: term || undefined, limit },
    });
    return mapProfessionalSearchResults(data);
  },

  // ── Staff self-service profile (staff-self or salon owner, authed) ────────

  /** Full editable profile (contact, socials, visibility) for the editor. */
  async getEditableProfile(
    salonId: string,
    staffId: string,
  ): Promise<EditableStaffProfile> {
    const { data } = await api.get(
      `/salons/${salonId}/staff/${staffId}/profile`,
    );
    return mapEditableStaffProfile(data?.data ?? data);
  },

  /** PATCH salons/:salonId/staff/:staffId/profile — returns fresh state. */
  async updateStaffProfile(
    salonId: string,
    staffId: string,
    payload: UpdateStaffProfilePayload,
  ): Promise<EditableStaffProfile> {
    const { data } = await api.patch(
      `/salons/${salonId}/staff/${staffId}/profile`,
      payload,
    );
    return mapEditableStaffProfile(data?.data ?? data);
  },
};
