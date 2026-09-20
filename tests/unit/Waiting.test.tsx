import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Waiting } from '../../src/components/Common/Waiting/Waiting';
import { useWaitingStore } from '../../src/components/Common/Waiting/waitingStore';

describe('Waiting 统一等待组件', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useWaitingStore.setState({ entries: {} });
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  it('等待中展示转圈与统一提示文本', () => {
    render(<Waiting waitKey="a" active tip="正在等待回复…" timeout={1000} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('正在等待回复…')).toBeTruthy();
  });

  it('active 为 false 时不渲染任何内容（不残留）', () => {
    const { container, rerender } = render(
      <Waiting waitKey="a" active={false} />,
    );
    expect(container.textContent).toBe('');

    rerender(<Waiting waitKey="a" active tip="请稍候…" />);
    expect(screen.getByText('请稍候…')).toBeTruthy();

    rerender(<Waiting waitKey="a" active={false} />);
    expect(container.textContent).toBe('');
  });

  it('超时后展示说明与「重新开始」，点击后重新计时并触发回调', () => {
    const onRetry = vi.fn();
    const onTimeout = vi.fn();
    render(
      <Waiting
        waitKey="a"
        active
        tip="加载中…"
        timeoutText="太久了，重新来吧。"
        timeout={1000}
        onTimeout={onTimeout}
        onRetry={onRetry}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.queryByText('太久了，重新来吧。')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.getByText('太久了，重新来吧。')).toBeTruthy();
    expect(onTimeout).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('重新开始'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    // 重新进入等待态
    expect(screen.getByText('加载中…')).toBeTruthy();
    expect(screen.queryByText('太久了，重新来吧。')).toBeNull();

    // 重新计时：再过一个超时时长后再次超时
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(screen.getByText('太久了，重新来吧。')).toBeTruthy();
    expect(onTimeout).toHaveBeenCalledTimes(2);
  });

  it('未提供 onRetry 时超时只展示说明，不出现重新开始按钮', () => {
    render(<Waiting waitKey="a" active timeoutText="卡住了。" timeout={100} />);
    act(() => {
      vi.advanceTimersByTime(101);
    });
    expect(screen.getByText('卡住了。')).toBeTruthy();
    expect(screen.queryByText('重新开始')).toBeNull();
  });

  it('两种等待同时出现时各自独立，互不顶掉', () => {
    const { rerender } = render(
      <div>
        <Waiting
          waitKey="send"
          active
          tip="发送中…"
          timeoutText="发送超时说明"
          timeout={500}
        />
        <Waiting
          waitKey="reply"
          active
          tip="正在等待回复…"
          timeoutText="回复超时说明"
          timeout={1000}
        />
      </div>,
    );

    expect(screen.getByText('发送中…')).toBeTruthy();
    expect(screen.getByText('正在等待回复…')).toBeTruthy();

    // 先超时的只是自己变成说明，另一个继续转圈
    act(() => {
      vi.advanceTimersByTime(501);
    });
    expect(screen.getByText('发送超时说明')).toBeTruthy();
    expect(screen.queryByText('回复超时说明')).toBeNull();
    expect(screen.getByText('正在等待回复…')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(501);
    });
    expect(screen.getByText('发送超时说明')).toBeTruthy();
    expect(screen.getByText('回复超时说明')).toBeTruthy();

    // 只结束其中一个
    rerender(
      <div>
        <Waiting
          waitKey="send"
          active={false}
          tip="发送中…"
          timeoutText="发送超时说明"
          timeout={500}
        />
        <Waiting
          waitKey="reply"
          active
          tip="正在等待回复…"
          timeoutText="回复超时说明"
          timeout={1000}
        />
      </div>,
    );
    expect(screen.queryByText('发送超时说明')).toBeNull();
    // reply 已经超时，保持超时说明
    expect(screen.getByText('回复超时说明')).toBeTruthy();
  });

  it('成功结束发生在超时之后也不残留：超时后结束即清空', () => {
    const { rerender, container } = render(
      <Waiting waitKey="a" active timeout={100} timeoutText="超时说明" />,
    );
    act(() => {
      vi.advanceTimersByTime(101);
    });
    expect(screen.getByText('超时说明')).toBeTruthy();

    // 迟到的成功
    rerender(<Waiting waitKey="a" active={false} />);
    expect(container.textContent).toBe('');
  });

  it('卸载时清理等待与计时器，不残留状态', () => {
    const onTimeout = vi.fn();
    const { unmount } = render(
      <Waiting waitKey="a" active timeout={100} onTimeout={onTimeout} />,
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onTimeout).not.toHaveBeenCalled();
    expect(useWaitingStore.getState().entries['a']).toBeUndefined();
  });
});
