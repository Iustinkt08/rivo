import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';

@Module({
  controllers: [SalonsController],
  providers: [SalonsService],
  exports: [SalonsService], // exported for use in AppointmentsModule, StaffModule, etc.
})
export class SalonsModule {}
