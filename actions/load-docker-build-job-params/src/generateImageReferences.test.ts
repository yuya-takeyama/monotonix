import {
  extractAppLabel,
  generateSemverDatetimeTag,
} from './generateImageReferences';

describe('extractAppLabel', () => {
  it('removes root directory from app path', () => {
    expect(extractAppLabel('apps/my-app', 'apps')).toBe('my-app');
    expect(extractAppLabel('apps/backend/api', 'apps')).toBe('backend/api');
  });

  it('handles root directory with trailing slash', () => {
    expect(extractAppLabel('apps/my-app', 'apps/')).toBe('my-app');
  });

  it('returns full path when not starting with root directory', () => {
    expect(extractAppLabel('other/my-app', 'apps')).toBe('other/my-app');
  });

  it('handles empty root directory', () => {
    expect(extractAppLabel('apps/my-app', '')).toBe('apps/my-app');
  });

  it('handles exact match of root directory', () => {
    expect(extractAppLabel('apps', 'apps')).toBe('');
  });
});

describe('generateSemverDatetimeTag', () => {
  const timestamp = 1704067200; // 2024-01-01 00:00:00 UTC

  it('generates tag in UTC timezone', () => {
    const tag = generateSemverDatetimeTag(timestamp, 'UTC');
    expect(tag).toBe('0.0.20240101000000');
  });

  it('generates tag in Asia/Tokyo timezone', () => {
    const tag = generateSemverDatetimeTag(timestamp, 'Asia/Tokyo');
    expect(tag).toBe('0.0.20240101090000');
  });

  it('generates tag in America/Los_Angeles timezone', () => {
    const tag = generateSemverDatetimeTag(timestamp, 'America/Los_Angeles');
    expect(tag).toBe('0.0.20231231160000');
  });

  it('throws error for invalid timezone', () => {
    expect(() => generateSemverDatetimeTag(timestamp, 'invalid')).toThrow(
      'Invalid timezone: invalid',
    );
  });
});
