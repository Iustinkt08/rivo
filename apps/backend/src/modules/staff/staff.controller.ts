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
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('salons/:salonId/staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all active staff for a salon' })
  findAll(@Param('salonId') salonId: string) {
    return this.staffService.findAll(salonId);
  }

  @Public()
  @Get(':staffId')
  @ApiOperation({ summary: 'Get staff member details' })
  findOne(@Param('salonId') salonId: string, @Param('staffId') staffId: string) {
    return this.staffService.findOne(salonId, staffId);
  }

  @Post()
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Add a staff member to the salon' })
  create(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStaffDto,
  ) {
    return this.staffService.create(salonId, userId, dto);
  }

  @Patch(':staffId')
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Update staff member info and services' })
  update(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(salonId, staffId, userId, dto);
  }

  @Delete(':staffId')
  @Roles('ADMIN_SALON')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a staff member (soft delete)' })
  remove(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.staffService.remove(salonId, staffId, userId);
  }

  // ─── Schedule ─────────────────────────────────────────────────────────────────

  @Patch(':staffId/schedule')
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Set weekly schedule for a staff member' })
  setSchedule(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SetScheduleDto,
  ) {
    return this.staffService.setSchedule(salonId, staffId, userId, dto);
  }

  // ─── Time-off ─────────────────────────────────────────────────────────────────

  @Post(':staffId/time-off')
  @Roles('ADMIN_SALON')
  @ApiOperation({ summary: 'Add a time-off block for a staff member' })
  addTimeOff(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTimeOffDto,
  ) {
    return this.staffService.addTimeOff(salonId, staffId, userId, dto);
  }

  @Delete(':staffId/time-off/:blockId')
  @Roles('ADMIN_SALON')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a time-off block' })
  removeTimeOff(
    @Param('salonId') salonId: string,
    @Param('staffId') staffId: string,
    @Param('blockId') blockId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.staffService.removeTimeOff(salonId, staffId, blockId, userId);
  }
}
