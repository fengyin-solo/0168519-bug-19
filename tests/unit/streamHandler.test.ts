import { describe, it, expect, vi } from 'vitest';
import { StreamHandler } from '../../src/services/stream';

function createDeferredStream(values: Array<() => Promise<string>>) {
  const pulls = values;
  let index = 0;
  const generator = async function* () {
    while (index < pulls.length) {
      const pull = pulls[index];
      if (!pull) break;
      index++;
      yield await pull();
    }
  };
  return generator();
}

describe('StreamHandler 中止语义（重新开始时不触发错误回调）', () => {
  it('正常完成时触发 onComplete', async () => {
    const handler = new StreamHandler();
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await handler.start(
      createDeferredStream([
        async () => '你',
        async () => '好',
      ]),
      { onChunk, onComplete, onError },
    );

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('abort 后中断迭代且不触发 onError / onComplete', async () => {
    const handler = new StreamHandler();
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    let resolveSecond: (v: string) => void = () => {};
    const startPromise = handler.start(
      createDeferredStream([
        async () => 'first',
        () => new Promise<string>((resolve) => { resolveSecond = resolve; }),
      ]),
      { onChunk, onComplete, onError },
    );

    // 等待首个分片后中止
    await vi.waitFor(() => expect(onChunk).toHaveBeenCalledWith('first'));
    handler.abort();
    resolveSecond('second');
    await startPromise;

    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('流自身抛错（非中止）时触发 onError', async () => {
    const handler = new StreamHandler();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const generator = async function* () {
      yield 'a';
      throw new Error('boom');
    };

    await handler.start(generator(), {
      onChunk: vi.fn(),
      onComplete,
      onError,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
