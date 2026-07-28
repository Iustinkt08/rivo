import { supabase } from './supabase';

// ─── Client-side image validation (mirrors the staff-gallery bucket limits) ───

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

const EXTENSION_TO_MIME: Record<string, AllowedImageMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const MIME_TO_EXTENSION: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Minimal structural shape of an expo-image-picker asset. */
export interface PickedImageAsset {
  uri: string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
}

/** File descriptor ready for a React Native FormData part. */
export interface ValidatedImage {
  uri: string;
  name: string;
  type: AllowedImageMime;
}

/**
 * Validates a picked image before upload: type must be JPEG/PNG/WebP and size
 * at most 5MB (when the picker reports it — the backend re-validates anyway).
 * Throws an Error with a user-facing Romanian message on failure.
 */
export function validateImage(asset: PickedImageAsset): ValidatedImage {
  const extension =
    (asset.fileName ?? asset.uri).split('.').pop()?.toLowerCase() ?? '';
  const candidateMime =
    asset.mimeType?.toLowerCase() ?? EXTENSION_TO_MIME[extension] ?? null;
  const type = ALLOWED_IMAGE_MIMES.find((mime) => mime === candidateMime);
  if (!type) {
    throw new Error(
      'Format de imagine neacceptat. Alege o poză JPEG, PNG sau WebP.',
    );
  }

  if (asset.fileSize != null && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Imaginea este prea mare — dimensiunea maximă este 5MB.');
  }

  return {
    uri: asset.uri,
    name: asset.fileName ?? `photo.${MIME_TO_EXTENSION[type]}`,
    type,
  };
}

// ─── Direct-to-Supabase uploads (avatars, salon logos) ───

async function uploadToStorage(bucket: string, path: string, localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const response = await fetch(localUri);
  const blob = await response.blob();

  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, { contentType: mime, upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  return uploadToStorage('avatars', `${userId}/avatar.${ext}`, localUri);
}

export async function uploadSalonLogo(salonId: string, localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  return uploadToStorage('salon-assets', `${salonId}/logo.${ext}`, localUri);
}

export async function uploadSalonGalleryPhoto(salonId: string, localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return uploadToStorage('salon-assets', `${salonId}/gallery/${unique}.${ext}`, localUri);
}
