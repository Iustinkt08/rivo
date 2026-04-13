import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClientProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSalonOwner(salonId: string, userId: string) {
    const salon = await this.prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.adminId !== userId) throw new ForbiddenException('Not your salon');
    return salon;
  }

  // ── Upsert helper ─────────────────────────────────────────────────────────

  private upsert(salonId: string, clientId: string) {
    return {
      where: { salonId_clientId: { salonId, clientId } },
      create: { salonId, clientId },
      update: {},
    };
  }

  // ── List salon clients ─────────────────────────────────────────────────────
  // Aggregates from appointments + merges ClientSalonProfile overrides

  async listClients(salonId: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);

    // Get all unique clients who have appointments at this salon
    const appointments = await this.prisma.appointment.findMany({
      where: { salonId },
      select: {
        clientId: true,
        status: true,
        startAt: true,
        client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
      orderBy: { startAt: 'desc' },
    });

    // Deduplicate and compute visit stats
    const clientMap = new Map<string, {
      id: string; firstName: string; lastName: string; phone?: string; email?: string;
      totalVisits: number; noShowCount: number; lastVisitAt?: string;
    }>();

    for (const appt of appointments) {
      const c = appt.client;
      const existing = clientMap.get(c.id) ?? {
        id: c.id, firstName: c.firstName, lastName: c.lastName,
        phone: c.phone ?? undefined, email: c.email ?? undefined,
        totalVisits: 0, noShowCount: 0, lastVisitAt: undefined,
      };

      if (appt.status === 'COMPLETED') existing.totalVisits++;
      if (appt.status === 'NO_SHOW') existing.noShowCount++;
      if (!existing.lastVisitAt && appt.status === 'COMPLETED') {
        existing.lastVisitAt = appt.startAt.toISOString().split('T')[0];
      }

      clientMap.set(c.id, existing);
    }

    // Merge ClientSalonProfile overrides (notes, isBlocked)
    const profiles = await this.prisma.clientSalonProfile.findMany({
      where: { salonId, clientId: { in: Array.from(clientMap.keys()) } },
    });

    const profileMap = new Map(profiles.map((p) => [p.clientId, p]));

    return Array.from(clientMap.values()).map((c) => {
      const profile = profileMap.get(c.id);
      return {
        ...c,
        notes: profile?.internalNotes ?? null,
        isBlocked: profile?.isBlocked ?? false,
      };
    });
  }

  // ── Update notes ──────────────────────────────────────────────────────────

  async updateNotes(salonId: string, clientId: string, userId: string, notes: string) {
    await this.assertSalonOwner(salonId, userId);

    const profile = await this.prisma.clientSalonProfile.upsert({
      ...this.upsert(salonId, clientId),
      update: { internalNotes: notes },
      create: { salonId, clientId, internalNotes: notes },
    });

    return { clientId, notes: profile.internalNotes };
  }

  // ── Toggle block ──────────────────────────────────────────────────────────

  async toggleBlock(salonId: string, clientId: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);

    // Get current state (or default false)
    const existing = await this.prisma.clientSalonProfile.findUnique({
      where: { salonId_clientId: { salonId, clientId } },
    });

    const newBlocked = !(existing?.isBlocked ?? false);

    const profile = await this.prisma.clientSalonProfile.upsert({
      where: { salonId_clientId: { salonId, clientId } },
      update: { isBlocked: newBlocked },
      create: { salonId, clientId, isBlocked: newBlocked },
    });

    return { clientId, isBlocked: profile.isBlocked };
  }
}
