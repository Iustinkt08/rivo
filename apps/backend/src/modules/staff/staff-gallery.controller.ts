import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreatePhotoCategoryDto,
  UploadStaffPhotoDto,
} from './dto/staff-gallery.dto';
import { StaffGalleryService } from './staff-gallery.service';
import type { UploadedPhotoFile } from './staff-gallery.service';

// Mirrors the staff-gallery bucket limits (5MB, jpeg/png/webp). The mime is
// validated against magic numbers, not just the client-declared header.
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = /^image\/(jpeg|png|webp)$/;

const photoFilePipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: MAX_PHOTO_SIZE_BYTES }),
    new FileTypeValidator({ fileType: ALLOWED_IMAGE_MIME }),
  ],
});

@ApiTags('Staff gallery')
@ApiBearerAuth()
@Controller('salons/:salonId/staff/:staffId')
export class StaffGalleryController {
  constructor(private readonly galleryService: StaffGalleryService) {}

  // ─── Photos ──────────────────────────────────────────────────────────────────

  @Post('photos')
  @Roles('ADMIN_SALON', 'STAFF_MEMBER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a gallery photo (staff self or salon owner)' })
  uploadPhoto(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
    @CurrentUser() user: User,
    @UploadedFile(photoFilePipe) file: UploadedPhotoFile,
    @Body() dto: UploadStaffPhotoDto,
  ) {
    return this.galleryService.uploadPhoto(salonId, staffId, user, file, dto);
  }

  @Delete('photos/:photoId')
  @Roles('ADMIN_SALON', 'STAFF_MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a gallery photo (staff self or salon owner)' })
  deletePhoto(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: User,
  ) {
    return this.galleryService.deletePhoto(salonId, staffId, user, photoId);
  }

  // ─── Categories ──────────────────────────────────────────────────────────────

  @Public()
  @Get('photo-categories')
  @ApiOperation({ summary: 'List photo categories with their photos (public)' })
  listCategories(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.galleryService.listCategories(salonId, staffId);
  }

  @Post('photo-categories')
  @Roles('ADMIN_SALON', 'STAFF_MEMBER')
  @ApiOperation({ summary: 'Create a photo category (staff self or salon owner)' })
  createCategory(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
    @CurrentUser() user: User,
    @Body() dto: CreatePhotoCategoryDto,
  ) {
    return this.galleryService.createCategory(salonId, staffId, user, dto);
  }

  @Delete('photo-categories/:categoryId')
  @Roles('ADMIN_SALON', 'STAFF_MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a photo category — its photos are kept, uncategorised',
  })
  deleteCategory(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: User,
  ) {
    return this.galleryService.deleteCategory(
      salonId,
      staffId,
      user,
      categoryId,
    );
  }
}
