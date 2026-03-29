import { describe, it, expect } from 'vitest';
import { interpolate, InterpolationError } from '../parser/interpolator.js';

describe('interpolate', () => {
  it('substitutes a single variable', () => {
    const result = interpolate('Hello, {{name}}!', { name: 'World' });
    expect(result).toBe('Hello, World!');
  });

  it('substitutes multiple variables in one template', () => {
    const result = interpolate('{{greeting}}, {{name}}!', {
      greeting: 'Hi',
      name: 'Alice',
    });
    expect(result).toBe('Hi, Alice!');
  });

  it('substitutes nested-like dot-notation keys', () => {
    const result = interpolate('User: {{user.name}}', { 'user.name': 'Bob' });
    expect(result).toBe('User: Bob');
  });

  it('throws InterpolationError for an unresolved variable', () => {
    expect(() => interpolate('Hello, {{missing}}!', {})).toThrow(
      InterpolationError,
    );
  });

  it('throws InterpolationError with the variable name in the message', () => {
    expect(() => interpolate('{{foo}}', {})).toThrow(
      'Unresolved variable "{{foo}}"',
    );
  });

  it('returns empty string for an empty template', () => {
    expect(interpolate('', {})).toBe('');
  });

  it('returns the template unchanged when it contains no variables', () => {
    const template = 'No placeholders here.';
    expect(interpolate(template, {})).toBe(template);
  });

  it('substitutes the same variable appearing multiple times', () => {
    const result = interpolate('{{x}} and {{x}}', { x: 'hello' });
    expect(result).toBe('hello and hello');
  });
});
