import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

/**
 * Injects the authenticated User from request.
 * Usage: @CurrentUser() user: User
 * Usage with field: @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (field: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: User }>();
    return field ? request.user?.[field] : request.user;
  },
);
