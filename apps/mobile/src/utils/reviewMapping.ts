// Pure mapper for GET /salons/:id/reviews — includes per-review staff
// attribution (staffId/staffName resolved server-side via appointment→staff).
// API-client-free so it stays unit-testable (convention: notificationMapping.ts).

export interface SalonReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  replyText: string | null;
  repliedAt: string | null; // ISO — set once the salon has replied
  createdAt: string; // ISO
  clientName: string;
  clientAvatarUrl: string | null;
  staffId: string | null;
  staffName: string | null;
}

// "Maria Ionescu" → "Maria I." — client privacy on public surfaces.
function formatClientDisplayName(client: any): string {
  const first = typeof client?.firstName === 'string' ? client.firstName.trim() : '';
  const lastInitial =
    typeof client?.lastName === 'string' ? client.lastName.trim()[0] : undefined;
  if (!first) return 'Client';
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

export function mapSalonReview(raw: any): SalonReviewItem {
  return {
    id: String(raw?.id ?? ''),
    rating: Number(raw?.rating ?? 0),
    comment: raw?.comment ?? null,
    replyText: raw?.replyText ?? null,
    repliedAt: raw?.repliedAt ?? null,
    createdAt: raw?.createdAt ?? '',
    clientName: formatClientDisplayName(raw?.client),
    clientAvatarUrl: raw?.client?.avatarUrl ?? null,
    staffId: raw?.staffId ?? null,
    staffName: raw?.staffName ?? null,
  };
}

export function mapSalonReviews(raw: unknown): SalonReviewItem[] {
  const list: any[] = Array.isArray(raw) ? raw : ((raw as any)?.data ?? []);
  if (!Array.isArray(list)) return [];
  return list.filter((r) => r && r.id).map(mapSalonReview);
}
