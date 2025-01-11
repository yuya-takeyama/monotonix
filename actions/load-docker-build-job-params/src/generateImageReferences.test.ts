import { generateSemverDatetimeTag } from './generateImageReferences';

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
