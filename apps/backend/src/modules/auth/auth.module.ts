import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StaffAuthService } from './staff-auth.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    StaffAuthService,
    SupabaseAuthGuard,
    RolesGuard,
    // Register SupabaseAuthGuard globally so every route is protected by default.
    // Use @Public() to opt-out on specific routes.
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
