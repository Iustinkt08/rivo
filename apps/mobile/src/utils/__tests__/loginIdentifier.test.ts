import {
  isEmailIdentifier,
  isUsernameIdentifier,
  normalizeUsername,
} from '../loginIdentifier';

describe('loginIdentifier', () => {
  test('treats a plain handle as a staff username', () => {
    // Arrange
    const input = 'marinica.gonel';

    // Act + Assert
    expect(isUsernameIdentifier(input)).toBe(true);
    expect(isEmailIdentifier(input)).toBe(false);
  });

  test('treats anything containing @ as an email, not a username', () => {
    expect(isUsernameIdentifier('ana@salon.ro')).toBe(false);
    expect(isEmailIdentifier('ana@salon.ro')).toBe(true);
  });

  test('rejects usernames shorter than 3 characters', () => {
    expect(isUsernameIdentifier('ab')).toBe(false);
    expect(isUsernameIdentifier('  a  ')).toBe(false);
  });

  test('ignores surrounding whitespace', () => {
    expect(isUsernameIdentifier('  marinica  ')).toBe(true);
  });

  test('normalizeUsername lowercases and trims', () => {
    expect(normalizeUsername('  Marinica.G  ')).toBe('marinica.g');
  });
});
