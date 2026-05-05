import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';

/**
 * Auth flow:
 *  1. Mobile authenticates with Firebase (OTP / Google / Apple) → receives Firebase ID Token
 *  2. Mobile sends ID Token in: Authorization: Bearer <firebase-id-token>
 *  3. POST /auth/verify  → backend verifies token, upserts user, returns profile
 *  4. All other protected routes use the same Bearer token per request
 */
@ApiTags('Auth')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Called once after Firebase login to fetch or create the server-side user.
   * Returns isNewUser=true when the account is created for the first time,
   * so the mobile app can redirect to the profile completion screen.
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Firebase token & upsert user' })
  @ApiOkResponse({ type: AuthResponseDto })
  async verify(@CurrentUser() user: User & { isNewUser?: boolean }): Promise<AuthResponseDto> {
    return {
      user: this.sanitize(user),
      isNewUser: user.isNewUser ?? false,
    };
  }

  /**
   * Called on the first login when isNewUser=true.
   * Lets the user complete their name, phone, and choose a role (CLIENT vs ADMIN_SALON).
   */
  @Post('complete-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete profile after first login' })
  @ApiCreatedResponse({ type: AuthUserDto })
  async completeProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDto,
  ): Promise<AuthUserDto> {
    const user = await this.authService.completeProfile(userId, dto);
    return this.sanitize(user);
  }

  /**
   * Returns the current authenticated user's profile.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: AuthUserDto })
  async me(@CurrentUser('id') userId: string): Promise<AuthUserDto> {
    const user = await this.authService.getProfile(userId);
    return this.sanitize(user);
  }

  /**
   * Update name, email, phone or avatar.
   */
  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ type: AuthUserDto })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUserDto> {
    const user = await this.authService.updateProfile(userId, dto);
    return this.sanitize(user);
  }

  /**
   * Soft-delete the account (sets isActive=false).
   * Hard deletion should be triggered separately after Firebase account deletion.
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate account' })
  async deleteMe(@CurrentUser('id') userId: string): Promise<void> {
    await this.authService.deactivate(userId);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Strip internal fields (firebaseUid, updatedAt, etc.) from the response.
   */
  private sanitize(user: User): AuthUserDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
