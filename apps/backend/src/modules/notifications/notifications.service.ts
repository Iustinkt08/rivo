import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

// Aligned with the mobile app's notificationStore NotificationType union.
export type NotificationType =
  | 'NEW_BOOKING'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_REJECTED'
  | 'CANCELLATION'
  | 'RESCHEDULED'
  | 'PRICE_CHANGE'
  | 'DURATION_CHANGE'
  | 'NO_SHOW'
  | 'REVIEW'
  | 'REMINDER';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  appointmentId?: string;
}

export interface NotificationPreferences {
  onAccepted: boolean;
  onRejected: boolean;
  onCancelled: boolean;
  onRescheduled: boolean;
  onPriceChange: boolean;
  onDurationChange: boolean;
  onReview: boolean;
  onReminder: boolean;
}

// Matches the Prisma schema defaults — every notification type is opted in.
export const NOTIFICATION_PREFERENCE_DEFAULTS: NotificationPreferences = {
  onAccepted: true,
  onRejected: true,
  onCancelled: true,
  onRescheduled: true,
  onPriceChange: true,
  onDurationChange: true,
  onReview: true,
  onReminder: true,
};

// Types without an entry (NEW_BOOKING, NO_SHOW) are always sent:
// NEW_BOOKING goes to salon admins and is business-critical.
const PREFERENCE_FIELD_BY_TYPE: Partial<
  Record<NotificationType, keyof NotificationPreferences>
> = {
  BOOKING_ACCEPTED: 'onAccepted',
  BOOKING_REJECTED: 'onRejected',
  CANCELLATION: 'onCancelled',
  RESCHEDULED: 'onRescheduled',
  PRICE_CHANGE: 'onPriceChange',
  DURATION_CHANGE: 'onDurationChange',
  REVIEW: 'onReview',
  REMINDER: 'onReminder',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists an in-app notification, unless the recipient opted out of the
   * given type. Callers on non-critical paths (e.g. right after a booking is
   * created) must wrap this in try/catch so a notification failure never
   * breaks the main operation. Returns null when skipped by preference.
   */
  async notify(userId: string, input: NotifyInput) {
    const { type, title, body, appointmentId } = input;

    const isEnabled = await this.isTypeEnabledFor(userId, type);
    if (!isEnabled) return null;

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

  /**
   * Returns the caller's preferences. When no row exists the schema defaults
   * (all true) are returned without creating a row.
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!preference) return { ...NOTIFICATION_PREFERENCE_DEFAULTS };
    return this.toPreferencesShape(preference);
  }

  /** Upserts the caller's preference row and returns the updated preferences. */
  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const updated = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
    return this.toPreferencesShape(updated);
  }

  /**
   * Checks whether the recipient opted in to the given type. Types without a
   * preference field (NEW_BOOKING, NO_SHOW) and users without a preference
   * row are always sent. Fails open on lookup errors so a preference check
   * can never block a notification.
   */
  private async isTypeEnabledFor(
    userId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const field = PREFERENCE_FIELD_BY_TYPE[type];
    if (!field) return true;

    try {
      const preference = await this.prisma.notificationPreference.findUnique({
        where: { userId },
      });
      if (!preference) return true;
      return preference[field];
    } catch (error) {
      this.logger.warn(
        `Preference check failed for user ${userId} (type ${type}), sending anyway: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return true;
    }
  }

  /** Projects a preference row onto the public 8-boolean shape. */
  private toPreferencesShape(
    row: NotificationPreferences,
  ): NotificationPreferences {
    return {
      onAccepted: row.onAccepted,
      onRejected: row.onRejected,
      onCancelled: row.onCancelled,
      onRescheduled: row.onRescheduled,
      onPriceChange: row.onPriceChange,
      onDurationChange: row.onDurationChange,
      onReview: row.onReview,
      onReminder: row.onReminder,
    };
  }
}
