import { Module } from '@nestjs/common';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';

@Module({
  controllers: [DiscountsController],
  providers: [DiscountsService],
  // Exported so AppointmentsService can re-run the exact same validation
  // rules inside its booking transaction.
  exports: [DiscountsService],
})
export class DiscountsModule {}
