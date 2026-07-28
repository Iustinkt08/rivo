import {
  PROFESSIONAL_DEEP_LINK_PREFIX,
  buildProfessionalShare,
} from '../professionalShare';

describe('buildProfessionalShare', () => {
  test('builds the navira:// deep link for the professional', () => {
    // Act
    const { url } = buildProfessionalShare('staff-123');

    // Assert
    expect(url).toBe('navira://professional/staff-123');
    expect(url.startsWith(PROFESSIONAL_DEEP_LINK_PREFIX)).toBe(true);
  });

  test('includes the professional name and the link in the message', () => {
    // Act
    const { message } = buildProfessionalShare('staff-123', 'Ana Pop');

    // Assert
    expect(message).toBe(
      'Descoperă profilul lui Ana Pop pe NAVIRA: navira://professional/staff-123',
    );
  });

  test('falls back to a generic message without a name', () => {
    // Act
    const { message } = buildProfessionalShare('staff-123', '  ');

    // Assert
    expect(message).toBe(
      'Descoperă acest specialist pe NAVIRA: navira://professional/staff-123',
    );
  });
});
