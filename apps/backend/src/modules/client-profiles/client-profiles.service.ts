import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClientProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSalonOwner(salonId: string, userId: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });
    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.adminId !== userId)
      throw new ForbiddenException('Not your salon');
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

    // Distinct clients seen at this salon, most-recent first — one row per client,
    // instead of pulling every appointment row (+ client join) into memory.
    const clientGroups = await this.prisma.appointment.groupBy({
      by: ['clientId'],
      where: { salonId },
      _max: { startAt: true },
      orderBy: { _max: { startAt: 'desc' } },
    });
    const clientIds = clientGroups.map((g) => g.clientId);
    if (!clientIds.length) return [];

    // Visit stats per (client, status) computed DB-side rather than in a JS loop.
    const statusStats = await this.prisma.appointment.groupBy({
      by: ['clientId', 'status'],
      where: { salonId, clientId: { in: clientIds } },
      _count: { _all: true },
      _max: { startAt: true },
    });

    const [clients, profiles] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      }),
      this.prisma.clientSalonProfile.findMany({
        where: { salonId, clientId: { in: clientIds } },
      }),
    ]);

    const userMap = new Map(clients.map((c) => [c.id, c]));
    const profileMap = new Map(profiles.map((p) => [p.clientId, p]));

    const stats = new Map<
      string,
      { totalVisits: number; noShowCount: number; lastVisitAt?: string }
    >();
    for (const s of statusStats) {
      const cur = stats.get(s.clientId) ?? {
        totalVisits: 0,
        noShowCount: 0,
        lastVisitAt: undefined,
      };
      if (s.status === 'COMPLETED') {
        cur.totalVisits += s._count._all;
        if (s._max.startAt)
          cur.lastVisitAt = s._max.startAt.toISOString().split('T')[0];
      }
      if (s.status === 'NO_SHOW') cur.noShowCount += s._count._all;
      stats.set(s.clientId, cur);
    }

    // Preserve the most-recent-first ordering from clientGroups.
    return clientGroups
      .map((g) => {
        const u = userMap.get(g.clientId);
        if (!u) return null;
        const st = stats.get(g.clientId) ?? {
          totalVisits: 0,
          noShowCount: 0,
          lastVisitAt: undefined,
        };
        const profile = profileMap.get(g.clientId);
        return {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone ?? undefined,
          email: u.email ?? undefined,
          totalVisits: st.totalVisits,
          noShowCount: st.noShowCount,
          lastVisitAt: st.lastVisitAt,
          notes: profile?.internalNotes ?? null,
          isBlocked: profile?.isBlocked ?? false,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }

  // ── Update notes ──────────────────────────────────────────────────────────

  async updateNotes(
    salonId: string,
    clientId: string,
    userId: string,
    notes: string,
  ) {
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
