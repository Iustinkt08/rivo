import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SalonsModule } from './modules/salons/salons.module';
import { ServicesModule } from './modules/services/services.module';
import { StaffModule } from './modules/staff/staff.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ClientProfilesModule } from './modules/client-profiles/client-profiles.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DiscountsModule } from './modules/discounts/discounts.module';

// Default API-wide rate limit; sensitive endpoints override it with @Throttle().
// NOTE: behind a reverse proxy set `app.set('trust proxy', ...)` so the limit
// tracks the real client IP, not the proxy's.
const GLOBAL_RATE_LIMIT = { ttl: seconds(60), limit: 100 };

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot({ throttlers: [GLOBAL_RATE_LIMIT] }),
    PrismaModule,
    AuthModule,
    SalonsModule,
    ServicesModule,
    StaffModule,
    AppointmentsModule,
    ClientProfilesModule,
    ReviewsModule,
    AddressesModule,
    NotificationsModule,
    DiscountsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
