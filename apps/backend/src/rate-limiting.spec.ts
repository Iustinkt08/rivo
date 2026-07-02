import 'reflect-metadata';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, seconds } from '@nestjs/throttler';
import { AppModule } from './app.module';
import { AppointmentsController } from './modules/appointments/appointments.controller';
import { AuthController } from './modules/auth/auth.controller';

// Metadata keys written by @nestjs/throttler's @Throttle decorator for the
// "default" throttler. Not re-exported from the package root — mirrored from
// node_modules/@nestjs/throttler/dist/throttler.constants.
const TTL_KEY = 'THROTTLER:TTLdefault';
const LIMIT_KEY = 'THROTTLER:LIMITdefault';

describe('Rate limiting', () => {
  it('registers ThrottlerGuard as a global guard on AppModule', () => {
    // Arrange
    const providers: any[] = Reflect.getMetadata('providers', AppModule) ?? [];

    // Act
    const guard = providers.find(
      (p) => p?.provide === APP_GUARD && p?.useClass === ThrottlerGuard,
    );

    // Assert
    expect(guard).toBeDefined();
  });

  it('applies a strict 5/min limit to appointment creation', () => {
    // Arrange
    const handler = AppointmentsController.prototype.create;

    // Assert
    expect(Reflect.getMetadata(LIMIT_KEY, handler)).toBe(5);
    expect(Reflect.getMetadata(TTL_KEY, handler)).toBe(seconds(60));
  });

  it('applies a 15/min limit to slot locking', () => {
    // Arrange
    const handler = AppointmentsController.prototype.lockSlot;

    // Assert
    expect(Reflect.getMetadata(LIMIT_KEY, handler)).toBe(15);
    expect(Reflect.getMetadata(TTL_KEY, handler)).toBe(seconds(60));
  });

  it('applies a 5/min limit to auth verify and complete-profile', () => {
    // Arrange
    const handlers = [
      AuthController.prototype.verify,
      AuthController.prototype.completeProfile,
    ];

    // Assert
    for (const handler of handlers) {
      expect(Reflect.getMetadata(LIMIT_KEY, handler)).toBe(5);
      expect(Reflect.getMetadata(TTL_KEY, handler)).toBe(seconds(60));
    }
  });
});
