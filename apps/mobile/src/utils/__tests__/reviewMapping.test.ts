import { mapSalonReviews } from '../reviewMapping';

describe('mapSalonReviews', () => {
  const serverReview = {
    id: 'rev-1',
    rating: 5,
    comment: 'Foarte bine',
    replyText: null,
    createdAt: '2026-06-01T10:00:00.000Z',
    client: { firstName: 'Maria', lastName: 'Ionescu', avatarUrl: null },
    staffId: 'staff-1',
    staffName: 'Ana Pop',
  };

  test('maps reviews with staff attribution and privacy-formatted client name', () => {
    // Act
    const [review] = mapSalonReviews([serverReview]);

    // Assert
    expect(review).toMatchObject({
      id: 'rev-1',
      rating: 5,
      comment: 'Foarte bine',
      clientName: 'Maria I.',
      staffId: 'staff-1',
      staffName: 'Ana Pop',
    });
  });

  test('handles missing staff attribution and missing client gracefully', () => {
    // Act
    const [review] = mapSalonReviews([
      { id: 'rev-2', rating: 4, client: null, staffId: null, staffName: null },
    ]);

    // Assert
    expect(review).toMatchObject({
      clientName: 'Client',
      staffId: null,
      staffName: null,
    });
  });

  test('tolerates envelopes and malformed input', () => {
    // Act + Assert
    expect(mapSalonReviews({ data: [serverReview] })).toHaveLength(1);
    expect(mapSalonReviews(undefined)).toEqual([]);
    expect(mapSalonReviews([{ rating: 5 }])).toEqual([]); // id-less dropped
  });
});
