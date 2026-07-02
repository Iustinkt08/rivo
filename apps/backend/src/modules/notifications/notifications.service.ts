import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Aligned with the mobile app's notificationStore NotificationType union.
export type NotificationType =
  | 'NEW_BOOKING'
  | 'CANCELLATION'
  | 'NO_SHOW'
  | 'REVIEW'
  | 'REMINDER';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  appointmentId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists an in-app notification. Callers on non-critical paths (e.g. right
   * after a booking is created) must wrap this in try/catch so a notification
   * failure never breaks the main operation.
   */
  notify(userId: string, input: NotifyInput) {
    const { type, title, body, appointmentId } = input;
    return this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        data: appointmentId ? { type, appointmentId } : { type },
      },
    });
  }

  listFor(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId)
      throw new ForbiddenException('Not your notification');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
