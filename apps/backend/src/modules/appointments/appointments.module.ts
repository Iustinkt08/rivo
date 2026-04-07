import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { SlotLockService } from './slot-lock.service';
import Redis from 'ioredis';

@Module({
  imports: [ConfigModule],
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
        });

        client.on('error', (err) => {
          console.error('[Redis] Connection error:', err.message);
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [AppointmentsService, 'REDIS_CLIENT'],
})
export class AppointmentsModule {}
