import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as admin from 'firebase-admin';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { FIREBASE_ADMIN } from '../../firebase/firebase.module';
import { AuthService } from '../auth.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(FIREBASE_ADMIN) private readonly firebaseApp: admin.app.App,
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
      const decoded = await this.firebaseApp.auth().verifyIdToken(token, true);
      // Attach the full DB user to the request for downstream use
      request['user'] = await this.authService.getOrCreateUser(decoded);
      return true;
    } catch {
      throw new UnauthorizedException('Firebase token is invalid or expired');
    }
  }

  private extractBearerToken(req: Request): string | null {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}
