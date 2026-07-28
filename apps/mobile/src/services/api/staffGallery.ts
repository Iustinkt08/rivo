import { api } from './client';
import { PickedImageAsset, validateImage } from '../storage';

// Uploads can carry up to 5MB over mobile networks — give them more room
// than the default 10s API timeout.
const UPLOAD_TIMEOUT_MS = 30000;

export interface StaffPhoto {
  id: string;
  staffId: string;
  categoryId: string | null;
  url: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface StaffPhotoCategory {
  id: string;
  staffId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  photos: StaffPhoto[];
}

export interface UploadStaffPhotoOptions {
  categoryId?: string;
  caption?: string;
}

/**
 * Uploads one gallery photo through the backend proxy (the bucket has no
 * client-side write policies). Validates type/size locally first — throws an
 * Error with a Romanian message on invalid images.
 */
export async function uploadStaffPhoto(
  salonId: string,
  staffId: string,
  asset: PickedImageAsset,
  options: UploadStaffPhotoOptions = {},
): Promise<StaffPhoto> {
  const image = validateImage(asset);

  const form = new FormData();
  // React Native FormData file part: { uri, name, type }
  form.append('file', {
    uri: image.uri,
    name: image.name,
    type: image.type,
  } as unknown as Blob);
  if (options.categoryId) form.append('categoryId', options.categoryId);
  if (options.caption) form.append('caption', options.caption);

  const { data } = await api.post<StaffPhoto>(
    `/salons/${salonId}/staff/${staffId}/photos`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    },
  );
  return data;
}

export async function deleteStaffPhoto(
  salonId: string,
  staffId: string,
  photoId: string,
): Promise<void> {
  await api.delete(`/salons/${salonId}/staff/${staffId}/photos/${photoId}`);
}

/**
 * Editor listing (staff self or salon owner): categories with their photos,
 * ordered by sortOrder. Public profiles get the gallery via professionalsApi,
 * server-gated by publicSettings.showGallery.
 */
export async function listPhotoCategories(
  salonId: string,
  staffId: string,
): Promise<StaffPhotoCategory[]> {
  const { data } = await api.get<StaffPhotoCategory[]>(
    `/salons/${salonId}/staff/${staffId}/photo-categories`,
  );
  return data;
}

export async function createPhotoCategory(
  salonId: string,
  staffId: string,
  name: string,
  sortOrder?: number,
): Promise<StaffPhotoCategory> {
  const { data } = await api.post<StaffPhotoCategory>(
    `/salons/${salonId}/staff/${staffId}/photo-categories`,
    sortOrder === undefined ? { name } : { name, sortOrder },
  );
  return data;
}

/** Deletes a category — its photos are kept (uncategorised) on the backend. */
export async function deletePhotoCategory(
  salonId: string,
  staffId: string,
  categoryId: string,
): Promise<void> {
  await api.delete(
    `/salons/${salonId}/staff/${staffId}/photo-categories/${categoryId}`,
  );
}
