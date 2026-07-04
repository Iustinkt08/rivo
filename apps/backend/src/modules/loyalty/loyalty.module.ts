import { Module } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  // Exported so AppointmentsService can auto-redeem earned rewards inside
  // its booking transaction with the same progress rules.
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
