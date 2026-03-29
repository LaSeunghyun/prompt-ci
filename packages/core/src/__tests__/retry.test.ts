import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry } from '../runner/retry.js';
import { ProviderError } from '../providers/base.js';

afterEach(() => {
  vi.useRealTimers();
});

// Helper: build a function that fails N times with a given error then succeeds
function failNTimes<T>(
  n: number,
  error: unknown,
  successValue: T,
): () => Promise<T> {
  let calls = 0;
  return async () => {
    calls += 1;
    if (calls <= n) throw error;
    return successValue;
  };
}

describe('withRetry', () => {
  it('returns the result immediately when the first call succeeds', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await withRetry(fn, 2);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on a 429 status code and eventually succeeds', async () => {
    vi.useFakeTimers();
    const err = new ProviderError('rate limited', 'openai', 429);
    const fn = failNTimes(1, err, 'recovered');

    const promise = withRetry(fn, 2);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toBe('recovered');
  });

  it('retries on a 500 status code', async () => {
    vi.useFakeTimers();
    const err = new ProviderError('server error', 'openai', 500);
    const fn = failNTimes(1, err, 'done');

    const promise = withRetry(fn, 2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await promise).toBe('done');
  });

  it('retries on a 502 status code', async () => {
    vi.useFakeTimers();
    const err = new ProviderError('bad gateway', 'openai', 502);
    const fn = failNTimes(1, err, 'done');

    const promise = withRetry(fn, 2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await promise).toBe('done');
  });

  it('retries on a 503 status code', async () => {
    vi.useFakeTimers();
    const err = new ProviderError('service unavailable', 'openai', 503);
    const fn = failNTimes(1, err, 'done');

    const promise = withRetry(fn, 2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await promise).toBe('done');
  });

  it('retries on a 504 status code', async () => {
    vi.useFakeTimers();
    const err = new ProviderError('gateway timeout', 'openai', 504);
    const fn = failNTimes(1, err, 'done');

    const promise = withRetry(fn, 2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await promise).toBe('done');
  });

  it('does NOT retry on a 400 status code and throws immediately', async () => {
    const err = new ProviderError('bad request', 'openai', 400);
    const fn = vi.fn(async () => { throw err; });

    await expect(withRetry(fn, 2)).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on a 401 status code', async () => {
    const err = new ProviderError('unauthorized', 'openai', 401);
    const fn = vi.fn(async () => { throw err; });

    await expect(withRetry(fn, 2)).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on a 404 status code', async () => {
    const err = new ProviderError('not found', 'openai', 404);
    const fn = vi.fn(async () => { throw err; });

    await expect(withRetry(fn, 2)).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries exhausted and throws the last error', async () => {
    vi.useFakeTimers();
    const err = new ProviderError('rate limited', 'openai', 429);
    // Fails every time — will exhaust maxRetries=2
    const fn = vi.fn(async () => { throw err; });

    // Attach rejection handler BEFORE advancing timers so the promise is
    // never "unhandled" during the fake-timer flush.
    const promise = withRetry(fn, 2);
    const rejectionPromise = expect(promise).rejects.toThrow(err);

    await vi.advanceTimersByTimeAsync(10000);
    await rejectionPromise;

    // Initial attempt + 2 retries = 3 total calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws a non-retryable ProviderError immediately without retrying', async () => {
    const err = new ProviderError('invalid request', 'openai', 400);
    const fn = vi.fn(async () => { throw err; });

    await expect(withRetry(fn, 3)).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws a generic (non-ProviderError) error immediately without retrying', async () => {
    const err = new Error('unexpected');
    const fn = vi.fn(async () => { throw err; });

    await expect(withRetry(fn, 2)).rejects.toThrow('unexpected');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
