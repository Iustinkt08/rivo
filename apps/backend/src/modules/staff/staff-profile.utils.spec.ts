import {
  DEFAULT_PUBLIC_VISIBILITY,
  mergeVisibilitySettings,
  normalizeSocials,
  normalizeSocialValue,
  resolvePublicVisibility,
} from './staff-profile.utils';

describe('normalizeSocialValue', () => {
  it('keeps full https:// URLs untouched', () => {
    expect(normalizeSocialValue('instagram', 'https://instagram.com/ana')).toBe(
      'https://instagram.com/ana',
    );
  });

  it('expands bare handles per platform (with or without @)', () => {
    expect(normalizeSocialValue('instagram', '@ana.pop')).toBe(
      'https://instagram.com/ana.pop',
    );
    expect(normalizeSocialValue('facebook', 'ana.pop')).toBe(
      'https://facebook.com/ana.pop',
    );
    expect(normalizeSocialValue('tiktok', 'ana_pop')).toBe(
      'https://www.tiktok.com/@ana_pop',
    );
    expect(normalizeSocialValue('website', 'example.com')).toBe(
      'https://example.com',
    );
  });

  it('returns null for empty or @-only values', () => {
    expect(normalizeSocialValue('instagram', '   ')).toBeNull();
    expect(normalizeSocialValue('instagram', '@')).toBeNull();
  });
});

describe('normalizeSocials', () => {
  it('drops unknown keys, non-strings and empty values', () => {
    expect(
      normalizeSocials({
        instagram: '@ana',
        hacked: 'https://evil.example',
        facebook: 42,
        tiktok: '',
      }),
    ).toEqual({ instagram: 'https://instagram.com/ana' });
  });

  it('returns an empty object for non-object input', () => {
    expect(normalizeSocials(null)).toEqual({});
    expect(normalizeSocials('x')).toEqual({});
    expect(normalizeSocials([1, 2])).toEqual({});
  });
});

describe('resolvePublicVisibility', () => {
  it('returns defaults for null: socials+gallery on, contact+count off', () => {
    expect(resolvePublicVisibility(null)).toEqual({
      showSocials: true,
      showContact: false,
      showApptCount: false,
      showGallery: true,
    });
  });

  it('overrides only the boolean keys present', () => {
    expect(
      resolvePublicVisibility({ showContact: true, showGallery: 'yes' }),
    ).toEqual({ ...DEFAULT_PUBLIC_VISIBILITY, showContact: true });
  });
});

describe('mergeVisibilitySettings', () => {
  it('merges updates over stored booleans without mutating inputs', () => {
    // Arrange
    const stored = { showContact: true, junk: 'x' };
    const update = { showGallery: false };

    // Act
    const merged = mergeVisibilitySettings(stored, update);

    // Assert
    expect(merged).toEqual({ showContact: true, showGallery: false });
    expect(stored).toEqual({ showContact: true, junk: 'x' });
  });

  it('handles null stored values', () => {
    expect(mergeVisibilitySettings(null, { showSocials: false })).toEqual({
      showSocials: false,
    });
  });
});
