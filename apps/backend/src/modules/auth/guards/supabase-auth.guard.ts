import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { createRemoteJWKSet, decodeJwt, jwtVerify, JWTPayload } from 'jose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../auth.service';
import { StaffAuthService, STAFF_TOKEN_ISSUER } from '../staff-auth.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private JWKS: ReturnType<typeof createRemoteJWKSet>;
  private issuer: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly staffAuthService: StaffAuthService,
  ) {}

  onModuleInit() {
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    if (!supabaseUrl) {
      // Fail fast: verifying tokens against a wrong/hardcoded project is worse than not booting.
      throw new Error(
        'SUPABASE_URL is not set — cannot initialise Supabase JWKS verification',
      );
    }
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.JWKS = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException(
        'Authorization header missing or malformed',
      );
    }

    // Dual issuer: backend-issued staff tokens are verified with the local
    // HS256 secret; everything else goes through the Supabase JWKS path.
    if (this.isStaffToken(token)) {
      const staffPayload = await this.staffAuthService.verifyToken(token);
      const user = await this.authService.getActiveUserById(staffPayload.sub);
      if (!user) {
        throw new UnauthorizedException('Staff account no longer exists');
      }
      request['user'] = user;
      return true;
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.JWKS, {
        issuer: this.issuer,
        audience: 'authenticated',
      }));
    } catch (err) {
      this.logger.warn(`JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Supabase token is invalid or expired');
    }

    const sub = payload.sub as string;
    const email = payload.email as string | undefined;
    const phone = payload.phone as string | undefined;

    // DB errors propagate as 500, not silently swallowed as 401
    request['user'] = await this.authService.getOrCreateUser({
      uid: sub,
      email,
      phone,
    });
    return true;
  }

  private extractBearerToken(req: Request): string | null {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }

  // Unverified issuer peek — routing only; real verification happens after.
  private isStaffToken(token: string): boolean {
    try {
      return decodeJwt(token).iss === STAFF_TOKEN_ISSUER;
    } catch {
      return false;
    }
  }
}
