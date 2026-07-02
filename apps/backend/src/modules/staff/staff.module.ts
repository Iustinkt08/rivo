import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { ProfessionalsController } from './professionals.controller';
import { StaffService } from './staff.service';

@Module({
  controllers: [StaffController, ProfessionalsController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
