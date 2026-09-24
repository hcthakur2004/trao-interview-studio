import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
const payload = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
  });
async function provider() {
  vi.resetModules();
  vi.stubEnv('GEMINI_API_KEY', 'test-only-not-a-real-key');
  vi.stubEnv('LLM_MIN_INTERVAL_MS', '0');
  vi.stubEnv('LLM_TOKENS_PER_MINUTE', '1000000');
  return new (await import('../src/core/llm')).GeminiModel();
}
describe('provider failure handling', () => {
  it('omits expensive decoding bounds but still enforces them locally', async () => {
    const model = await provider();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(payload('{"answer":"too long"}'))
      .mockResolvedValueOnce(payload('{"answer":"ok"}'));
    vi.stubGlobal('fetch', fetcher);
    expect(
      await model.json(
        'bounded',
        {},
        z.object({ answer: z.string().max(3) }),
        new AbortController().signal,
      ),
    ).toEqual({ answer: 'ok' });
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.generationConfig.responseJsonSchema.properties.answer.maxLength).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('repairs malformed JSON instead of saving an invalid result', async () => {
    const model = await provider();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(payload('not json'))
      .mockResolvedValueOnce(payload('{"answer":"valid"}'));
    vi.stubGlobal('fetch', fetcher);
    expect(
      await model.json(
        'test task',
        {},
        z.object({ answer: z.string() }),
        new AbortController().signal,
      ),
    ).toEqual({ answer: 'valid' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('backs off on rate limiting and retries successfully', async () => {
    const model = await provider();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(payload('{"answer":"valid"}'));
    vi.stubGlobal('fetch', fetcher);
    expect(
      await model.json(
        'test task',
        {},
        z.object({ answer: z.string() }),
        new AbortController().signal,
      ),
    ).toEqual({ answer: 'valid' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not retry invalid credentials', async () => {
    const model = await provider();
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      model.json('test task', {}, z.object({ answer: z.string() }), new AbortController().signal),
    ).rejects.toMatchObject({ code: 'PROVIDER_REJECTED' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('stops after three invalid structured responses', async () => {
    const model = await provider();
    const fetcher = vi.fn().mockImplementation(async () => payload('{}'));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      model.json('test task', {}, z.object({ answer: z.string() }), new AbortController().signal),
    ).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('reports a transport outage separately from malformed model output', async () => {
    const model = await provider();
    const fetcher = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      model.json('test task', {}, z.object({ answer: z.string() }), new AbortController().signal),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('honors cancellation before calling the provider', async () => {
    const model = await provider();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    controller.abort(new Error('Cancelled by test'));
    await expect(
      model.json('test task', {}, z.object({ answer: z.string() }), controller.signal),
    ).rejects.toThrow('Cancelled');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
