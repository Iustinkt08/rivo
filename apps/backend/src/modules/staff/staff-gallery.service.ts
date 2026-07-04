import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  CreatePhotoCategoryDto,
  UploadStaffPhotoDto,
} from './dto/staff-gallery.dto';

/**
 * Minimal shape of a multer memory-storage upload — declared locally so the
 * backend does not need @types/multer for a single field.
 */
export interface UploadedPhotoFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Injectable()
export class StaffGalleryService {
  private readonly logger = new Logger(StaffGalleryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── Authorization ───────────────────────────────────────────────────────────

  /**
   * Gallery writes are allowed to exactly two callers:
   *  - the staff member themselves — staff tokens carry sub = Staff.userId,
   *    and the guard resolves that to request.user, so `staff.userId ===
   *    user.id` is the DB-backed equivalent of `claims.staffId === :staffId`;
   *  - the ADMIN_SALON who owns :salonId (salon.adminId === user.id).
   * In both cases the staff member must belong to :salonId.
   */
  private async assertCanManageGallery(
    salonId: string,
    staffId: string,
    user: User,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, salonId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    if (user.role === UserRole.ADMIN_SALON) {
      const salon = await this.prisma.salon.findUnique({
        where: { id: salonId },
      });
      if (!salon) throw new NotFoundException('Salon not found');
      if (salon.adminId !== user.id) {
        throw new ForbiddenException('Not your salon');
      }
      return staff;
    }

    if (staff.userId && staff.userId === user.id) return staff;

    throw new ForbiddenException(
      'Only the staff member or the salon owner can manage this gallery',
    );
  }

  // ─── Photos ──────────────────────────────────────────────────────────────────

  async uploadPhoto(
    salonId: string,
    staffId: string,
    user: User,
    file: UploadedPhotoFile,
    dto: UploadStaffPhotoDto,
  ) {
    await this.assertCanManageGallery(salonId, staffId, user);

    // A category may only be attached if it belongs to the same staff member.
    if (dto.categoryId) {
      const category = await this.prisma.staffPhotoCategory.findFirst({
        where: { id: dto.categoryId, staffId },
      });
      if (!category) {
        throw new BadRequestException(
          'Photo category not found for this staff member',
        );
      }
    }

    const url = await this.storage.uploadStaffPhoto(
      staffId,
      file.buffer,
      file.mimetype,
    );

    try {
      return await this.prisma.staffPhoto.create({
        data: {
          staffId,
          categoryId: dto.categoryId ?? null,
          url,
          caption: dto.caption ?? null,
        },
      });
    } catch (err) {
      // DB failed after the object landed in storage — best-effort cleanup so
      // the bucket does not accumulate orphans, then surface the real error.
      await this.storage.deleteObjectByUrl(url).catch((cleanupErr: Error) => {
        this.logger.warn(
          `Orphaned storage object after failed photo insert: ${cleanupErr.message}`,
        );
      });
      throw err;
    }
  }

  async deletePhoto(
    salonId: string,
    staffId: string,
    user: User,
    photoId: string,
  ) {
    await this.assertCanManageGallery(salonId, staffId, user);

    const photo = await this.prisma.staffPhoto.findFirst({
      where: { id: photoId, staffId },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    await this.prisma.staffPhoto.delete({ where: { id: photoId } });

    // The DB row is the source of truth; a stale storage object is only a
    // cleanup concern, so a storage failure must not fail the request.
    try {
      await this.storage.deleteObjectByUrl(photo.url);
    } catch (err) {
      this.logger.warn(
        `Photo ${photoId} deleted from DB but storage cleanup failed: ${(err as Error).message}`,
      );
    }
  }

  // ─── Categories ──────────────────────────────────────────────────────────────

  async createCategory(
    salonId: string,
    staffId: string,
    user: User,
    dto: CreatePhotoCategoryDto,
  ) {
    await this.assertCanManageGallery(salonId, staffId, user);

    return this.prisma.staffPhotoCategory.create({
      data: {
        staffId,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /**
   * Editor listing: categories (with their photos), both ordered by sortOrder.
   * Restricted to the staff member / salon owner — public consumers get the
   * gallery via the professional profile, gated by publicSettings.showGallery.
   */
  async listCategories(salonId: string, staffId: string, user: User) {
    await this.assertCanManageGallery(salonId, staffId, user);

    return this.prisma.staffPhotoCategory.findMany({
      where: { staffId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async deleteCategory(
    salonId: string,
    staffId: string,
    user: User,
    categoryId: string,
  ) {
    await this.assertCanManageGallery(salonId, staffId, user);

    const category = await this.prisma.staffPhotoCategory.findFirst({
      where: { id: categoryId, staffId },
    });
    if (!category) throw new NotFoundException('Photo category not found');

    // Photos survive the category: StaffPhoto.categoryId is ON DELETE SET NULL.
    await this.prisma.staffPhotoCategory.delete({ where: { id: categoryId } });
  }
}
