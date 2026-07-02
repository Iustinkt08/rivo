/**
 * Rivo — Standalone Category Seed / Reconcile
 * Run: npx tsx prisma/seed-categories.ts   (from apps/backend)
 *
 * Idempotently upserts the FULL canonical category taxonomy into the live DB
 * WITHOUT wiping any other data, then reconciles the 3 legacy categories
 * (Masaj → Massage, Facial → Facials, Barbershop → Barbering) created by the
 * original seed. Category.name MUST match the code the client search sends as
 * ?category=... — see prisma/categories.ts for the rationale.
 *
 * Reads DATABASE_URL from apps/backend/.env.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { CANONICAL_CATEGORIES, LEGACY_CATEGORY_RENAMES } from './categories';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function upsertCanonical(): Promise<Record<string, string>> {
  const idByName: Record<string, string> = {};
  for (const { name, sortOrder } of CANONICAL_CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: { sortOrder, iconUrl: null },
      create: { name, sortOrder, iconUrl: null },
    });
    idByName[name] = cat.id;
  }
  console.log(
    `  ✅ Upserted ${CANONICAL_CATEGORIES.length} canonical categories`,
  );
  return idByName;
}

/**
 * For each legacy category still present: repoint every Service AND every
 * SalonCategory link onto the canonical category, then delete the legacy row.
 * Repointing SalonCategory (not just Service) is required both to satisfy the
 * FK on delete and to keep client category-search working — search filters
 * salons through the salon_categories join table.
 */
async function reconcileLegacy(
  canonicalIds: Record<string, string>,
): Promise<void> {
  for (const [legacyName, canonicalName] of Object.entries(
    LEGACY_CATEGORY_RENAMES,
  )) {
    const legacy = await prisma.category.findUnique({
      where: { name: legacyName },
    });
    if (!legacy) {
      console.log(
        `  ⏭️  Legacy '${legacyName}' not present — nothing to reconcile`,
      );
      continue;
    }

    const canonicalId = canonicalIds[canonicalName];
    if (!canonicalId) {
      console.warn(
        `  ⚠️  Canonical '${canonicalName}' missing — skipping '${legacyName}'`,
      );
      continue;
    }

    // 1. Repoint services
    const svc = await prisma.service.updateMany({
      where: { categoryId: legacy.id },
      data: { categoryId: canonicalId },
    });

    // 2. Repoint salon_categories (composite PK — upsert canonical, drop legacy)
    const legacyLinks = await prisma.salonCategory.findMany({
      where: { categoryId: legacy.id },
    });
    for (const link of legacyLinks) {
      await prisma.salonCategory.upsert({
        where: {
          salonId_categoryId: {
            salonId: link.salonId,
            categoryId: canonicalId,
          },
        },
        update: {},
        create: { salonId: link.salonId, categoryId: canonicalId },
      });
    }
    await prisma.salonCategory.deleteMany({ where: { categoryId: legacy.id } });

    // 3. Delete the now-unreferenced legacy category
    await prisma.category.delete({ where: { id: legacy.id } });

    console.log(
      `  🔀 '${legacyName}' → '${canonicalName}': ` +
        `${svc.count} service(s), ${legacyLinks.length} salon link(s) repointed, legacy deleted`,
    );
  }
}

async function main() {
  console.log('🌱 Seeding canonical categories...');
  const canonicalIds = await upsertCanonical();
  await reconcileLegacy(canonicalIds);

  const final = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { name: true, sortOrder: true },
  });
  console.log(`\n✅ Final categories (${final.length}):`);
  console.table(final);
}

main()
  .catch((e) => {
    console.error('❌ Category seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
