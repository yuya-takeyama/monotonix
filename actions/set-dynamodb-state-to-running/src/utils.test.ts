import { parseDuration } from './utils';

describe('parseDuration', () => {
  const validTestCases = [
    { input: '1h', expected: 3600 },
    { input: '1m', expected: 60 },
    { input: '1s', expected: 1 },
    { input: '1d', expected: 86400 },
    { input: '1h30m', expected: 5400 },
    { input: '2h45m10s', expected: 9910 },
    { input: '1h1m1s', expected: 3661 },
    { input: '0h0m0s', expected: 0 },
    { input: '10m5s', expected: 605 },
    { input: '3h', expected: 10800 },
    { input: '2h0m', expected: 7200 },
    { input: '1d0h', expected: 86400 },
  ];

  validTestCases.forEach(({ input, expected }) => {
    test(`parses "${input}" correctly`, () => {
      expect(parseDuration(input)).toBe(expected);
    });
  });

  const invalidTestCases = [
    { input: 'foo', expectedError: /Invalid format: foo/ },
    { input: '1', expectedError: /Invalid format: 1/ },
    { input: '1a', expectedError: /Invalid unit: a/ },
    { input: '1abc', expectedError: /Invalid unit: abc/ },
  ];

  invalidTestCases.forEach(({ input, expectedError }) => {
    test(`throws an error for "${input}"`, () => {
      expect(() => parseDuration(input)).toThrow(expectedError);
    });
  });
});
