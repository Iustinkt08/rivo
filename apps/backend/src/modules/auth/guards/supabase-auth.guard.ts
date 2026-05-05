import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../auth.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow routes marked with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Authorization header missing or malformed');
    }

    try {
      const decoded = this.jwtService.verify<{
        sub: string;
        email?: string;
        phone?: string;
      }>(token, { secret: process.env.SUPABASE_JWT_SECRET });

      // Attach the full DB user to the request for downstream use
      request['user'] = await this.authService.getOrCreateUser({
        uid: decoded.sub,
        email: decoded.email,
        phone: decoded.phone,
      });

      return true;
    } catch {
      throw new UnauthorizedException('Supabase token is invalid or expired');
    }
  }

  private extractBearerToken(req: Request): string | null {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}
