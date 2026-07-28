import {
  mapEditableStaffProfile,
  mapProfessionalProfile,
  mapProfessionalSearchResults,
} from '../professionalMapping';

describe('mapProfessionalProfile', () => {
  const serverProfile = {
    id: 'staff-1',
    firstName: 'Ana',
    lastName: 'Pop',
    fullName: 'Ana Pop',
    specialty: 'Hairstylist',
    avatarEmoji: '💇',
    avatarUrl: null,
    bio: 'Bio scurt',
    phone: '0700000000',
    email: 'ana@exemplu.ro',
    socials: { instagram: 'https://instagram.com/ana', junk: 'x' },
    completedAppointmentsCount: 12,
    galleryCategories: [
      {
        id: 'cat-1',
        name: 'Balayage',
        photos: [
          { id: 'ph-1', url: 'https://cdn/x.jpg', caption: 'Blond' },
          { id: 'ph-broken' }, // no url — dropped
        ],
      },
    ],
    salon: { id: 'salon-1', name: 'Salon Prost', slug: 'salon-prost', city: 'Cluj' },
    services: [{ id: 'svc-1', name: 'Tuns', price: '80', durationMin: 45 }],
    averageRating: 4.5,
    reviewCount: 2,
    reviews: [
      {
        id: 'rev-1',
        rating: 5,
        comment: 'Super',
        createdAt: '2026-06-01T10:00:00.000Z',
        clientName: 'Maria I.',
      },
    ],
  };

  test('maps a full server profile including salon, services and reviews', () => {
    // Act
    const profile = mapProfessionalProfile(serverProfile);

    // Assert
    expect(profile).toMatchObject({
      id: 'staff-1',
      fullName: 'Ana Pop',
      specialty: 'Hairstylist',
      salon: { id: 'salon-1', name: 'Salon Prost', city: 'Cluj' },
      averageRating: 4.5,
      reviewCount: 2,
    });
    expect(profile.services).toEqual([
      { id: 'svc-1', name: 'Tuns', price: 80, durationMin: 45 },
    ]);
    expect(profile.reviews).toEqual([
      {
        id: 'rev-1',
        rating: 5,
        comment: 'Super',
        createdAt: '2026-06-01T10:00:00.000Z',
        clientName: 'Maria I.',
      },
    ]);
  });

  test('maps visibility-gated fields when the server sends them', () => {
    // Act
    const profile = mapProfessionalProfile(serverProfile);

    // Assert — unknown social keys are dropped, gallery photos need a url
    expect(profile.socials).toEqual({ instagram: 'https://instagram.com/ana' });
    expect(profile.phone).toBe('0700000000');
    expect(profile.email).toBe('ana@exemplu.ro');
    expect(profile.completedAppointmentsCount).toBe(12);
    expect(profile.galleryCategories).toEqual([
      {
        id: 'cat-1',
        name: 'Balayage',
        photos: [{ id: 'ph-1', url: 'https://cdn/x.jpg', caption: 'Blond' }],
      },
    ]);
  });

  test('treats absent gated fields as hidden (server filtered them out)', () => {
    // Act
    const profile = mapProfessionalProfile({ id: 'x', firstName: 'Ana', lastName: 'Pop' });

    // Assert
    expect(profile.socials).toBeNull();
    expect(profile.phone).toBeNull();
    expect(profile.email).toBeNull();
    expect(profile.completedAppointmentsCount).toBeNull();
    expect(profile.galleryCategories).toEqual([]);
  });

  test('derives fullName from first/last when fullName is missing', () => {
    // Act
    const profile = mapProfessionalProfile({
      id: 'x',
      firstName: 'Ion',
      lastName: 'Popescu',
    });

    // Assert
    expect(profile.fullName).toBe('Ion Popescu');
  });

  test('falls back safely on malformed payloads', () => {
    // Act
    const profile = mapProfessionalProfile({
      id: 'x',
      services: 'nope',
      reviews: null,
      salon: {},
      socials: 'broken',
      galleryCategories: { not: 'an array' },
      completedAppointmentsCount: 'many',
    });

    // Assert
    expect(profile.services).toEqual([]);
    expect(profile.reviews).toEqual([]);
    expect(profile.salon).toBeNull();
    expect(profile.averageRating).toBe(0);
    expect(profile.socials).toBeNull();
    expect(profile.galleryCategories).toEqual([]);
    expect(profile.completedAppointmentsCount).toBeNull();
  });
});

describe('mapEditableStaffProfile', () => {
  test('maps the editable profile into form-friendly strings', () => {
    // Act
    const editable = mapEditableStaffProfile({
      id: 'staff-1',
      firstName: 'Ana',
      lastName: 'Pop',
      specialty: null,
      bio: 'Bio',
      phone: null,
      email: 'ana@exemplu.ro',
      avatarEmoji: '💇',
      avatarUrl: null,
      socials: { instagram: 'https://instagram.com/ana', tiktok: 7 },
      publicSettings: { showContact: true, showGallery: 'yes' },
    });

    // Assert
    expect(editable).toEqual({
      id: 'staff-1',
      firstName: 'Ana',
      lastName: 'Pop',
      specialty: '',
      bio: 'Bio',
      phone: '',
      email: 'ana@exemplu.ro',
      avatarEmoji: '💇',
      avatarUrl: null,
      socials: {
        instagram: 'https://instagram.com/ana',
        facebook: '',
        tiktok: '',
        website: '',
      },
      publicSettings: {
        showSocials: true,
        showContact: true,
        showApptCount: false,
        showGallery: true,
      },
    });
  });

  test('applies backend defaults when publicSettings is missing', () => {
    // Act
    const editable = mapEditableStaffProfile({ id: 'x' });

    // Assert — socials+gallery public, contact+count private
    expect(editable.publicSettings).toEqual({
      showSocials: true,
      showContact: false,
      showApptCount: false,
      showGallery: true,
    });
    expect(editable.avatarEmoji).toBe('👤');
  });
});

describe('mapProfessionalSearchResults', () => {
  test('maps a plain array and tolerates a {data:[...]} envelope', () => {
    // Arrange
    const item = {
      id: 'staff-1',
      fullName: 'Ana Pop',
      specialty: 'Nails',
      salon: { id: 's1', name: 'Salon' },
      appointmentCount: '3',
      averageRating: '4.8',
      reviewCount: 2,
    };

    // Act + Assert
    expect(mapProfessionalSearchResults([item])[0]).toMatchObject({
      id: 'staff-1',
      fullName: 'Ana Pop',
      appointmentCount: 3,
      averageRating: 4.8,
    });
    expect(mapProfessionalSearchResults({ data: [item] })).toHaveLength(1);
  });

  test('returns empty array for malformed input and drops id-less rows', () => {
    // Act + Assert
    expect(mapProfessionalSearchResults(undefined)).toEqual([]);
    expect(mapProfessionalSearchResults('nope')).toEqual([]);
    expect(mapProfessionalSearchResults([{ fullName: 'No Id' }])).toEqual([]);
  });
});
