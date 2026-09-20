import { describe, it, expect, beforeEach } from 'vitest';
import { useWaitingStore } from '../../src/components/Common/Waiting/waitingStore';

describe('waitingStore 键控等待', () => {
  beforeEach(() => {
    useWaitingStore.setState({ entries: {} });
  });

  it('begin/markTimeout/end 的基本生命周期', () => {
    const { begin, markTimeout, end, getEntry } = useWaitingStore.getState();

    expect(getEntry('a')).toBeUndefined();

    begin('a', '提示', '说明');
    expect(getEntry('a')?.phase).toBe('waiting');
    expect(getEntry('a')?.tip).toBe('提示');

    markTimeout('a');
    expect(getEntry('a')?.phase).toBe('timeout');
    expect(getEntry('a')?.timeoutText).toBe('说明');

    end('a');
    expect(getEntry('a')).toBeUndefined();
  });

  it('重复 begin 同名 key 不会覆盖已有等待', () => {
    const { begin, markTimeout, getEntry } = useWaitingStore.getState();

    begin('a', '第一次', '说明一');
    markTimeout('a');
    // 后到的同名等待不能把已超时的等待顶回 waiting
    begin('a', '第二次', '说明二');

    expect(getEntry('a')?.phase).toBe('timeout');
    expect(getEntry('a')?.tip).toBe('第一次');
  });

  it('不同 key 的等待互不影响', () => {
    const { begin, markTimeout, end, getEntry } = useWaitingStore.getState();

    begin('a');
    begin('b');
    markTimeout('a');

    expect(getEntry('a')?.phase).toBe('timeout');
    expect(getEntry('b')?.phase).toBe('waiting');

    end('a');
    expect(getEntry('a')).toBeUndefined();
    expect(getEntry('b')?.phase).toBe('waiting');
  });

  it('markTimeout/end 对不存在的 key 是空操作', () => {
    const { markTimeout, end, getEntry } = useWaitingStore.getState();
    expect(() => {
      markTimeout('ghost');
      end('ghost');
    }).not.toThrow();
    expect(getEntry('ghost')).toBeUndefined();
  });

  it('restart 将超时等待恢复为 waiting 并刷新文案', () => {
    const { begin, markTimeout, restart, getEntry } = useWaitingStore.getState();

    begin('a', '提示', '说明');
    markTimeout('a');
    restart('a', '重新提示', '重新说明');

    expect(getEntry('a')?.phase).toBe('waiting');
    expect(getEntry('a')?.tip).toBe('重新提示');
    expect(getEntry('a')?.timeoutText).toBe('重新说明');
  });

  it('成功结束后 end 必清除，即使之前已经超时', () => {
    const { begin, markTimeout, end, getEntry } = useWaitingStore.getState();

    begin('a');
    markTimeout('a');
    end('a');
    expect(getEntry('a')).toBeUndefined();
  });
});
