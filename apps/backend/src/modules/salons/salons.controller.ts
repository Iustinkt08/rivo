import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SalonsService } from './salons.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { SalonQueryDto } from './dto/salon-query.dto';
import { SetOpeningHoursDto } from './dto/opening-hours.dto';
import {
  PaginatedSalonsDto,
  SalonProfileDto,
} from './dto/salon-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Salons')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('salons')
export class SalonsController {
  constructor(private readonly salonsService: SalonsService) {}

  // ── Public endpoints (no auth required) ───────────────────────────────────

  /**
   * Discover salons: geo search, text search, filters, pagination.
   * When lat+lng are provided, results are sorted by distance (Haversine).
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Search salons (public)' })
  @ApiOkResponse({ type: PaginatedSalonsDto })
  findAll(@Query() query: SalonQueryDto): Promise<PaginatedSalonsDto> {
    return this.salonsService.findAll(query);
  }

  /**
   * Public salon profile page — used by client app to render salon details,
   * services, staff and gallery before booking.
   */
  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get salon public profile by slug (public)' })
  @ApiOkResponse({ type: SalonProfileDto })
  findBySlug(@Param('slug') slug: string): Promise<SalonProfileDto> {
    return this.salonsService.findBySlug(slug);
  }

  /**
   * Get opening hours for a salon (used by booking flow to show available days).
   */
  @Get(':id/opening-hours')
  @Public()
  @ApiOperation({ summary: 'Get salon opening hours (public)' })
  getOpeningHours(@Param('id', ParseUUIDPipe) id: string) {
    return this.salonsService.getOpeningHours(id);
  }

  // ── Business / owner endpoints (auth required) ────────────────────────────

  /**
   * Create a new salon. Requires ADMIN_SALON role.
   * The authenticated user becomes the salon owner.
   */
  @Post()
  @Roles(UserRole.ADMIN_SALON, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a salon (ADMIN_SALON only)' })
  @ApiCreatedResponse({ type: SalonProfileDto })
  create(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateSalonDto,
  ) {
    return this.salonsService.create(adminId, dto);
  }

  /**
   * The owner's own salon dashboard data (more detail than public profile).
   */
  @Get('my/salon')
  @Roles(UserRole.ADMIN_SALON, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get your own salon (ADMIN_SALON only)' })
  @ApiOkResponse({ type: SalonProfileDto })
  getMySalon(@CurrentUser('id') adminId: string): Promise<SalonProfileDto> {
    return this.salonsService.findMysalon(adminId);
  }

  /**
   * Update salon info (name, description, address, policies, etc.)
   * Only the salon owner or a SUPER_ADMIN can do this.
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN_SALON, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update salon (owner only)' })
  @ApiOkResponse({ type: SalonProfileDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateSalonDto,
  ) {
    return this.salonsService.update(id, userId, dto, role);
  }

  /**
   * Soft-delete (deactivate) a salon.
   * Appointments remain in the DB; future bookings are blocked.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN_SALON, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate salon (owner only)' })
  @ApiNoContentResponse()
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ): Promise<void> {
    return this.salonsService.deactivate(id, userId, role);
  }

  // ── Opening Hours ─────────────────────────────────────────────────────────

  /**
   * Set/replace the full weekly schedule.
   * Send all 7 days at once; missing days are left unchanged.
   */
  @Post(':id/opening-hours')
  @Roles(UserRole.ADMIN_SALON, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set weekly opening hours (owner only)' })
  setOpeningHours(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: SetOpeningHoursDto,
  ) {
    return this.salonsService.setOpeningHours(id, userId, dto, role);
  }

  // ── Photos ────────────────────────────────────────────────────────────────

  /**
   * Add a photo to the gallery.
   * In production, upload to S3/Cloudinary first, then send the URL here.
   */
  @Post(':id/photos')
  @Roles(UserRole.ADMIN_SALON, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add gallery photo (owner only)' })
  @ApiCreatedResponse()
  addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body('url') url: string,
    @Body('caption') caption?: string,
  ) {
    return this.salonsService.addPhoto(id, userId, url, caption, role);
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN_SALON, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove gallery photo (owner only)' })
  @ApiNoContentResponse()
  removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.salonsService.removePhoto(photoId, id, userId, role);
  }
}
