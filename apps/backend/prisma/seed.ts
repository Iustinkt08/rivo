/**
 * Rivo — Database Seed
 * Run: npm run prisma:seed
 *
 * Seeds: categories, 5 salons (Bucharest), opening hours,
 *        services per salon, staff per salon, staff schedules.
 */

import { PrismaClient, UserRole, DayOfWeek } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

// ── Helpers ───────────────────────────────────────────────────────────────────

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '-');
}

const DAYS: DayOfWeek[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
];

function openingHoursData(salonId: string, closedOnSunday = true) {
  return DAYS.map((day) => ({
    salonId,
    dayOfWeek: day,
    openTime: day === 'SATURDAY' ? '10:00' : '09:00',
    closeTime: day === 'SATURDAY' ? '17:00' : day === 'THURSDAY' || day === 'FRIDAY' ? '20:00' : '19:00',
    isClosed: closedOnSunday && day === 'SUNDAY',
  }));
}

function staffScheduleData(staffId: string) {
  return DAYS.map((day) => ({
    staffId,
    dayOfWeek: day,
    startTime: '09:00',
    endTime: '18:00',
    isOff: day === 'SUNDAY',
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting seed...');

  // ── Categories ─────────────────────────────────────────────────────────────
  const categoryNames = ['Hair', 'Nails', 'Masaj', 'Facial', 'Barbershop'];
  const categories: Record<string, string> = {};

  for (const [i, name] of categoryNames.entries()) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: i },
    });
    categories[name] = cat.id;
    console.log(`  ✅ Category: ${name}`);
  }

  // ── Admin user (placeholder — update firebaseUid after you sign up) ────────
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@rivo.ro' },
    update: {},
    create: {
      firebaseUid: 'REPLACE_WITH_YOUR_SUPABASE_USER_UUID',
      email: 'admin@rivo.ro',
      firstName: 'Admin',
      lastName: 'Rivo',
      role: UserRole.ADMIN_SALON,
    },
  });
  console.log(`  ✅ Admin user: ${adminUser.email}`);

  // ── Salons ─────────────────────────────────────────────────────────────────

  const salonsData = [
    {
      name: 'Studio Bella',
      description: 'Studio Bella este destinația ta pentru hair styling, manichiură și tratamente faciale de top. Echipa noastră de specialiști cu peste 10 ani experiență te va transforma.',
      phone: '+40712345678',
      addressLine1: 'Str. Florilor 12, Floreasca',
      city: 'București',
      latitude: 44.463,
      longitude: 26.1003,
      coverImageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
      categoryKeys: ['Hair', 'Nails', 'Facial'],
      services: [
        { name: 'Tuns + Spălat', category: 'Hair', durationMin: 45, price: 120 },
        { name: 'Vopsit integral', category: 'Hair', durationMin: 120, price: 280 },
        { name: 'Highlights', category: 'Hair', durationMin: 90, price: 220 },
        { name: 'Manichiură clasică', category: 'Nails', durationMin: 60, price: 80 },
        { name: 'Gel UV', category: 'Nails', durationMin: 90, price: 150 },
        { name: 'Tratament facial hidratant', category: 'Facial', durationMin: 60, price: 180 },
      ],
      staff: [
        { firstName: 'Elena', lastName: 'Ionescu', bio: 'Hair Stylist Senior cu 12 ani experiență' },
        { firstName: 'Mihai', lastName: 'Popa', bio: 'Colorist specializat în tehnici moderne' },
        { firstName: 'Ana', lastName: 'Gheorghe', bio: 'Nails Expert & Beauty Consultant' },
      ],
    },
    {
      name: 'Nails & More',
      description: 'Salonul tău de unghii din inima Bucureștiului. Oferim servicii premium de manichiură, pedichiură și nail art.',
      phone: '+40723456789',
      addressLine1: 'Bd. Unirii 5, Centru',
      city: 'București',
      latitude: 44.4268,
      longitude: 26.1025,
      coverImageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800',
      categoryKeys: ['Nails'],
      services: [
        { name: 'Manichiură clasică', category: 'Nails', durationMin: 45, price: 70 },
        { name: 'Gel UV mâini', category: 'Nails', durationMin: 90, price: 140 },
        { name: 'Pedichiură clasică', category: 'Nails', durationMin: 60, price: 90 },
        { name: 'Nail art (design)', category: 'Nails', durationMin: 30, price: 50 },
      ],
      staff: [
        { firstName: 'Alina', lastName: 'Dumitrescu', bio: 'Nail Artist cu specializare în nail art 3D' },
        { firstName: 'Ioana', lastName: 'Marin', bio: 'Specialist unghii gel și polygel' },
      ],
    },
    {
      name: 'The Barber Shop',
      description: 'Frizerie modernă cu atmosferă vintage. Tunsori clasice și contemporane pentru bărbați exigenți.',
      phone: '+40734567890',
      addressLine1: 'Calea Victoriei 30, Centru',
      city: 'București',
      latitude: 44.4352,
      longitude: 26.0978,
      coverImageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800',
      categoryKeys: ['Barbershop', 'Hair'],
      services: [
        { name: 'Tuns clasic', category: 'Barbershop', durationMin: 30, price: 60 },
        { name: 'Tuns + Barbă', category: 'Barbershop', durationMin: 50, price: 90 },
        { name: 'Contur barbă', category: 'Barbershop', durationMin: 20, price: 40 },
        { name: 'Ras clasic cu brici', category: 'Barbershop', durationMin: 30, price: 70 },
      ],
      staff: [
        { firstName: 'Andrei', lastName: 'Marin', bio: 'Master Barber cu 8 ani experiență' },
        { firstName: 'Cristian', lastName: 'Stoica', bio: 'Specialist tunsori fade și skin fade' },
      ],
    },
    {
      name: 'Glamour Salon',
      description: 'Salon de înfrumusețare complet din cartierul Dorobanți. Servicii de hair, make-up și tratamente faciale.',
      phone: '+40745678901',
      addressLine1: 'Str. Dorobanți 55, Dorobanți',
      city: 'București',
      latitude: 44.4651,
      longitude: 26.0821,
      coverImageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800',
      categoryKeys: ['Hair', 'Facial'],
      services: [
        { name: 'Coafat & Styling', category: 'Hair', durationMin: 60, price: 100 },
        { name: 'Tuns dame', category: 'Hair', durationMin: 60, price: 130 },
        { name: 'Tratament keratină', category: 'Hair', durationMin: 180, price: 400 },
        { name: 'Curățare ten profundă', category: 'Facial', durationMin: 75, price: 200 },
      ],
      staff: [
        { firstName: 'Maria', lastName: 'Ionescu', bio: 'Hairstylist & Make-up Artist' },
        { firstName: 'Gabriela', lastName: 'Radu', bio: 'Specialist tratamente par și ten' },
      ],
    },
    {
      name: 'Zen Massage & Spa',
      description: 'Oaza ta de relaxare din Aviatorilor. Masaje terapeutice, tratamente spa și ritualuri de wellness.',
      phone: '+40756789012',
      addressLine1: 'Str. Aviatorilor 12',
      city: 'București',
      latitude: 44.4703,
      longitude: 26.0754,
      coverImageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
      categoryKeys: ['Masaj', 'Facial'],
      services: [
        { name: 'Masaj relaxant 60min', category: 'Masaj', durationMin: 60, price: 180 },
        { name: 'Masaj relaxant 90min', category: 'Masaj', durationMin: 90, price: 250 },
        { name: 'Masaj terapeutic', category: 'Masaj', durationMin: 60, price: 200 },
        { name: 'Masaj cu pietre fierbinți', category: 'Masaj', durationMin: 90, price: 280 },
        { name: 'Facial anti-aging', category: 'Facial', durationMin: 60, price: 220 },
      ],
      staff: [
        { firstName: 'Valentina', lastName: 'Popescu', bio: 'Terapeut certificat în masaj suedez și sportiv' },
        { firstName: 'Daniel', lastName: 'Florescu', bio: 'Specialist wellness și masaj thai' },
      ],
    },
  ];

  for (const salonData of salonsData) {
    const { services, staff, categoryKeys, ...salonFields } = salonData;

    // Upsert salon
    const salon = await prisma.salon.upsert({
      where: { slug: slug(salonFields.name) },
      update: {},
      create: {
        ...salonFields,
        slug: slug(salonFields.name),
        adminId: adminUser.id,
        cancellationHours: 24,
        averageRating: 4.5 + Math.random() * 0.5,
        reviewCount: Math.floor(50 + Math.random() * 200),
      },
    });

    // Opening hours
    await prisma.openingHours.deleteMany({ where: { salonId: salon.id } });
    await prisma.openingHours.createMany({ data: openingHoursData(salon.id) });

    // Salon categories
    await prisma.salonCategory.deleteMany({ where: { salonId: salon.id } });
    for (const catKey of categoryKeys) {
      if (categories[catKey]) {
        await prisma.salonCategory.create({
          data: { salonId: salon.id, categoryId: categories[catKey] },
        });
      }
    }

    // Services
    const createdServices: Record<string, string> = {};
    for (const svc of services) {
      const existing = await prisma.service.findFirst({
        where: { salonId: salon.id, name: svc.name },
      });
      if (!existing) {
        const s = await prisma.service.create({
          data: {
            salonId: salon.id,
            categoryId: categories[svc.category],
            name: svc.name,
            durationMin: svc.durationMin,
            price: svc.price,
            isActive: true,
          },
        });
        createdServices[svc.name] = s.id;
      } else {
        createdServices[svc.name] = existing.id;
      }
    }

    // Staff
    for (const member of staff) {
      const existing = await prisma.staff.findFirst({
        where: { salonId: salon.id, firstName: member.firstName, lastName: member.lastName },
      });

      let staffMember = existing;
      if (!staffMember) {
        staffMember = await prisma.staff.create({
          data: {
            salonId: salon.id,
            firstName: member.firstName,
            lastName: member.lastName,
            bio: member.bio,
            isActive: true,
          },
        });
      }

      // Staff schedules
      await prisma.staffSchedule.deleteMany({ where: { staffId: staffMember.id } });
      await prisma.staffSchedule.createMany({ data: staffScheduleData(staffMember.id) });

      // Link all salon services to this staff member
      for (const svcId of Object.values(createdServices)) {
        await prisma.staffService.upsert({
          where: { staffId_serviceId: { staffId: staffMember.id, serviceId: svcId } },
          update: {},
          create: { staffId: staffMember.id, serviceId: svcId },
        });
      }
    }

    console.log(`  ✅ Salon: ${salon.name} (${services.length} services, ${staff.length} staff)`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\n⚠️  Next steps:');
  console.log('   1. Sign up in Supabase Auth (Dashboard → Authentication → Users → Add user)');
  console.log('   2. Copy the user UUID');
  console.log('   3. Run this SQL in Supabase SQL Editor:');
  console.log("      UPDATE users SET firebase_uid = '<YOUR_UUID>', role = 'ADMIN_SALON' WHERE email = 'admin@rivo.ro';");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
