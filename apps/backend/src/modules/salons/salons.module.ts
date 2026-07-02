import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';

@Module({
  controllers: [SalonsController, CategoriesController],
  providers: [SalonsService],
  exports: [SalonsService], // exported for use in AppointmentsModule, StaffModule, etc.
})
export class SalonsModule {}
