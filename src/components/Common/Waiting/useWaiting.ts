import { useCallback, useEffect, useRef } from 'react';
import { useWaitingStore, DEFAULT_WAITING_TIMEOUT } from './waitingStore';

export type WaitingPhaseState = 'idle' | 'waiting' | 'timeout';

export interface UseWaitingOptions {
  /** 等待的唯一标识：不同等待使用不同 key，互不顶掉 */
  key: string;
  /** 是否处于等待中；变为 true 时开始，变为 false 时必定清理 */
  active: boolean;
  /** 等待中的提示文本 */
  tip?: string;
  /** 超时后的说明文本 */
  timeoutText?: string;
  /** 超时时长（毫秒），默认 20s */
  timeout?: number;
  /** 到达超时时长时的回调（可用于中止底层请求） */
  onTimeout?: () => void;
  /** 点击「重新开始」时的回调（重新发起请求） */
  onRetry?: () => void;
}

export interface UseWaitingResult {
  /** idle：无等待；waiting：进行中；timeout：已超时 */
  phase: WaitingPhaseState;
  /** 重新开始：清除超时提示、重新计时并触发 onRetry */
  retry: () => void;
}

/**
 * 统一的等待生命周期管理
 *
 * - 同一个 key 的等待只存在一份，多个等待（如「发送中」与「等回复」）各自独立
 * - 超过 timeout 未结束时切换为超时说明，并保留重新开始入口
 * - active 变为 false 或组件卸载时必定清除，成功后不会残留提示
 */
export function useWaiting({
  key,
  active,
  tip,
  timeoutText,
  timeout = DEFAULT_WAITING_TIMEOUT,
  onTimeout,
  onRetry,
}: UseWaitingOptions): UseWaitingResult {
  const entry = useWaitingStore((state) => state.entries[key]);
  const begin = useWaitingStore((state) => state.begin);
  const markTimeout = useWaitingStore((state) => state.markTimeout);
  const restart = useWaitingStore((state) => state.restart);
  const end = useWaitingStore((state) => state.end);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 始终拿到最新的回调，避免计时器闭包过期
  const onTimeoutRef = useRef(onTimeout);
  const onRetryRef = useRef(onRetry);
  onTimeoutRef.current = onTimeout;
  onRetryRef.current = onRetry;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      markTimeout(key);
      onTimeoutRef.current?.();
    }, timeout);
  }, [key, timeout, markTimeout, clearTimer]);

  // active 驱动的开始 / 清理；timeout 变化时重新计时
  useEffect(() => {
    if (active) {
      begin(key, tip, timeoutText);
      startTimer();
    } else {
      clearTimer();
      end(key);
    }
    // tip / timeoutText 只在开始时写入，避免文案变化导致等待被重启
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, timeout, begin, startTimer, clearTimer, end]);

  // key 变化或卸载时清理旧 key，杜绝残留
  useEffect(() => {
    return () => {
      clearTimer();
      end(key);
    };
  }, [key, end, clearTimer]);

  const retry = useCallback(() => {
    restart(key, tip, timeoutText);
    startTimer();
    onRetryRef.current?.();
  }, [key, tip, timeoutText, restart, startTimer]);

  return {
    phase: entry ? entry.phase : 'idle',
    retry,
  };
}
