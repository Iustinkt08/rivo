import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export class CreateReviewDto {
  @IsUUID()
  appointmentId: string;

  // Bounded 1–5 integer — without this an attacker can POST any number and
  // corrupt the salon's cached average rating.
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(clientId: string, dto: CreateReviewDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: {
        salon: { select: { adminId: true, name: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.clientId !== clientId)
      throw new ForbiddenException('Not your appointment');
    if (appointment.status !== 'COMPLETED')
      throw new ForbiddenException('Can only review completed appointments');

    const existing = await this.prisma.review.findUnique({
      where: { appointmentId: dto.appointmentId },
    });
    if (existing)
      throw new ConflictException(
        'Review already submitted for this appointment',
      );

    const review = await this.prisma.review.create({
      data: {
        appointmentId: dto.appointmentId,
        clientId,
        salonId: appointment.salonId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
    });

    // Update salon average rating cache
    const agg = await this.prisma.review.aggregate({
      where: { salonId: appointment.salonId, isVisible: true },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.salon.update({
      where: { id: appointment.salonId },
      data: {
        averageRating: agg._avg.rating ?? 0,
        reviewCount: agg._count,
      },
    });

    // Notify the salon owner about the new review (non-fatal).
    try {
      const client =
        `${appointment.client?.firstName ?? ''} ${
          appointment.client?.lastName ?? ''
        }`.trim() || 'Un client';
      await this.notifications.notify(appointment.salon.adminId, {
        type: 'REVIEW',
        title: 'Recenzie nouă',
        body: `${client} a lăsat o recenzie de ${dto.rating}★.`,
        appointmentId: appointment.id,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify salon of new review (appointment=${appointment.id}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    return review;
  }

  async findBySalon(salonId: string, limit = 20) {
    const reviews = await this.prisma.review.findMany({
      where: { salonId, isVisible: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        client: {
          select: { firstName: true, lastName: true, avatarUrl: true },
        },
        appointment: {
          select: {
            staffId: true,
            staff: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    // Attribute each review to the professional who performed the appointment
    // (Review has no staffId column). The raw relation stays out of the payload.
    return reviews.map((review) => {
      const { appointment, ...rest } = review;
      const staff = appointment?.staff;
      return {
        ...rest,
        staffId: staff?.id ?? appointment?.staffId ?? null,
        staffName: staff ? `${staff.firstName} ${staff.lastName}`.trim() : null,
      };
    });
  }
}
