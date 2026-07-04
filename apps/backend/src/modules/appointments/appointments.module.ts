import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { SlotLockService } from './slot-lock.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import Redis from 'ioredis';

@Module({
  imports: [ConfigModule, NotificationsModule, DiscountsModule, LoyaltyModule],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    SlotLockService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const client = new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          lazyConnect: true,
          // Fail fast when Redis is down: commands reject immediately instead
          // of buffering forever, so SlotLockService can degrade gracefully.
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });

        client.on('error', (err) => {
          console.error(
            `[Redis] Connection error: ${err.message || String(err)}`,
          );
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [AppointmentsService, 'REDIS_CLIENT'],
})
export class AppointmentsModule {}
