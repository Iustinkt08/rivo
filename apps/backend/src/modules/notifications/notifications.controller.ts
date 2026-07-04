import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me')
  @ApiOperation({ summary: "List current user's notifications (newest first)" })
  listMine(@CurrentUser('id') userId: string) {
    return this.notifications.listFor(userId);
  }

  @Get('preferences')
  @ApiOperation({ summary: "Get current user's notification preferences" })
  getPreferences(@CurrentUser('id') userId: string) {
    return this.notifications.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: "Update current user's notification preferences" })
  updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notifications.updatePreferences(userId, dto);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notifications.markRead(id, userId);
  }
}
