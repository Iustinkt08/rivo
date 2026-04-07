import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('salons/:salonId/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all active services for a salon' })
  findAll(@Param('salonId') salonId: string) {
    return this.servicesService.findAll(salonId);
  }

  @Post()
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Create a new service' })
  create(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateServiceDto,
  ) {
    return this.servicesService.create(salonId, userId, dto);
  }

  @Patch(':serviceId')
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Update a service' })
  update(
    @Param('salonId') salonId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(salonId, serviceId, userId, dto);
  }

  @Patch(':serviceId/toggle')
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Toggle service active/inactive' })
  toggleActive(
    @Param('salonId') salonId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.servicesService.toggleActive(salonId, serviceId, userId);
  }

  @Delete(':serviceId')
  @Roles('ADMIN_SALON')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service' })
  remove(
    @Param('salonId') salonId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.servicesService.remove(salonId, serviceId, userId);
  }
}
