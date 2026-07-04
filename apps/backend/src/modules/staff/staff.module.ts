import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { ProfessionalsController } from './professionals.controller';
import { StaffGalleryController } from './staff-gallery.controller';
import { StaffService } from './staff.service';
import { StaffGalleryService } from './staff-gallery.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [
    StaffController,
    ProfessionalsController,
    StaffGalleryController,
  ],
  providers: [StaffService, StaffGalleryService],
  exports: [StaffService],
})
export class StaffModule {}
