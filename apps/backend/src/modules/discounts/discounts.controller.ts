import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';
import { DiscountsService } from './discounts.service';
import { CreateDiscountCodeDto } from './dto/create-discount-code.dto';
import { UpdateDiscountCodeDto } from './dto/update-discount-code.dto';
import { ValidateDiscountCodeDto } from './dto/validate-discount-code.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

// Abuse-prone: clients could brute-force codes — stricter than the 100/min
// global default (mirrors the booking limits in appointments.controller.ts).
const VALIDATE_LIMIT = { default: { limit: 10, ttl: seconds(60) } };

@ApiTags('Discount Codes')
@ApiBearerAuth()
@Controller('salons/:salonId/discount-codes')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  // ─── Owner management ────────────────────────────────────────────────────────

  @Post()
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Create a discount code (salon owner)' })
  create(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDiscountCodeDto,
  ) {
    return this.discountsService.create(salonId, userId, dto);
  }

  @Get()
  @Roles('ADMIN_SALON')
  @ApiOperation({
    summary: 'List discount codes with redemption counts (salon owner)',
  })
  findAll(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.discountsService.findAll(salonId, userId);
  }

  @Patch(':id')
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Update a discount code (salon owner)' })
  update(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDiscountCodeDto,
  ) {
    return this.discountsService.update(salonId, id, userId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN_SALON')
  @ApiOperation({
    summary:
      'Delete a discount code — hard-delete when never redeemed, otherwise retire (isActive=false)',
  })
  remove(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.discountsService.remove(salonId, id, userId);
  }

  // ─── Checkout validation (any authenticated user) ────────────────────────────

  @Post('validate')
  @Throttle(VALIDATE_LIMIT)
  @ApiOperation({
    summary:
      'Validate a discount code for a service — returns server-computed amounts',
  })
  validate(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ValidateDiscountCodeDto,
  ) {
    return this.discountsService.validate(salonId, userId, dto);
  }
}
