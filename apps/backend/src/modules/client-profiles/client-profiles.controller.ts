import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientProfilesService } from './client-profiles.service';
import { IsString } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

class UpdateNotesDto {
  @IsString()
  notes: string;
}

@ApiTags('Client Profiles')
@ApiBearerAuth()
@Controller('salons/:salonId/clients')
export class ClientProfilesController {
  constructor(private readonly service: ClientProfilesService) {}

  @Get()
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'List all clients for this salon with visit stats' })
  list(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.listClients(salonId, userId);
  }

  @Patch(':clientId/notes')
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Update internal notes for a client' })
  updateNotes(
    @Param('salonId') salonId: string,
    @Param('clientId') clientId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotesDto,
  ) {
    return this.service.updateNotes(salonId, clientId, userId, dto.notes);
  }

  @Patch(':clientId/block')
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Toggle block/unblock a client for this salon' })
  toggleBlock(
    @Param('salonId') salonId: string,
    @Param('clientId') clientId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.toggleBlock(salonId, clientId, userId);
  }
}
