import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { UpsertPunchCardDto } from './dto/upsert-punch-card.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller()
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // ─── Salon config (business) ─────────────────────────────────────────────────

  @Put('salons/:salonId/punch-card')
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Create or update the punch-card config (owner)' })
  upsertConfig(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertPunchCardDto,
  ) {
    return this.loyaltyService.upsertConfig(salonId, userId, dto);
  }

  @Get('salons/:salonId/punch-card')
  @Roles('ADMIN_SALON', 'STAFF_MEMBER')
  @ApiOperation({
    summary: 'Get the punch-card config, or null (owner or active staff)',
  })
  getConfig(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.loyaltyService.getConfig(salonId, userId);
  }

  @Get('salons/:salonId/punch-card/clients/:clientId/progress')
  @Roles('ADMIN_SALON', 'STAFF_MEMBER')
  @ApiOperation({
    summary: "A client's punch-card progress at this salon (owner or staff)",
  })
  getClientProgress(
    @Param('salonId') salonId: string,
    @Param('clientId') clientId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.loyaltyService.getClientProgress(salonId, clientId, userId);
  }

  // ─── My punch cards (any authenticated user) ─────────────────────────────────

  @Get('loyalty/punch-cards/me')
  @ApiOperation({
    summary: "Current user's punch cards across salons with active configs",
  })
  getMyPunchCards(@CurrentUser('id') clientId: string) {
    return this.loyaltyService.getMyPunchCards(clientId);
  }
}
