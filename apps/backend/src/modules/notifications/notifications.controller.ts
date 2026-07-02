import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
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
