import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// All writes to this bucket go through the backend with the service-role key —
// the bucket itself has NO client-side write policies (public read only).
const STAFF_GALLERY_BUCKET = 'staff-gallery';

// Whitelist mirrors the bucket's mime configuration (jpeg/png/webp).
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class StorageService {
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * Lazy client creation: SUPABASE_SERVICE_ROLE_KEY may be absent in
   * environments that never touch storage (e.g. unit tests), so we fail with
   * a clear message at first use instead of at boot.
   */
  private getClient(): SupabaseClient {
    if (this.client) return this.client;

    const url = this.config.get<string>('SUPABASE_URL');
    if (!url) {
      throw new InternalServerErrorException(
        'SUPABASE_URL is not set — cannot reach Supabase Storage',
      );
    }
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY is not set — photo storage is unavailable until it is configured',
      );
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.client;
  }

  /**
   * Uploads one staff gallery image to `staff-gallery/{staffId}/{uuid}.{ext}`
   * and returns its public URL.
   */
  async uploadStaffPhoto(
    staffId: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    const extension = MIME_TO_EXTENSION[mimetype];
    if (!extension) {
      throw new BadRequestException(
        'Unsupported image type — allowed: JPEG, PNG, WebP',
      );
    }

    const bucket = this.getClient().storage.from(STAFF_GALLERY_BUCKET);
    const path = `${staffId}/${randomUUID()}.${extension}`;

    const { error } = await bucket.upload(path, buffer, {
      contentType: mimetype,
    });
    if (error) {
      throw new InternalServerErrorException(
        `Photo upload failed: ${error.message}`,
      );
    }

    return bucket.getPublicUrl(path).data.publicUrl;
  }

  /**
   * Removes the storage object referenced by a public URL previously returned
   * from uploadStaffPhoto. Throws on unrecognised URLs or storage errors —
   * callers decide whether that is fatal (it usually is not after a DB delete).
   */
  async deleteObjectByUrl(url: string): Promise<void> {
    const marker = `/storage/v1/object/public/${STAFF_GALLERY_BUCKET}/`;
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) {
      throw new Error(
        `URL does not point into the ${STAFF_GALLERY_BUCKET} bucket: ${url}`,
      );
    }

    const path = decodeURIComponent(
      url.slice(markerIndex + marker.length).split('?')[0],
    );
    const { error } = await this.getClient()
      .storage.from(STAFF_GALLERY_BUCKET)
      .remove([path]);
    if (error) {
      throw new Error(`Storage delete failed for ${path}: ${error.message}`);
    }
  }
}
