import { useEffect, useState } from 'react';
import { Button, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import './LoadingIndicator.css';

/** 默认超时时间（毫秒）：超过后展示可重新开始的说明 */
export const DEFAULT_LOADING_TIMEOUT = 15000;

/** 统一的转圈尺寸 */
const SPINNER_SIZES = {
  small: 16,
  default: 24,
  large: 32,
} as const;

interface LoadingIndicatorProps {
  /** 是否处于等待中；传入 false 时不渲染并清除超时提示，不传则始终展示 */
  loading?: boolean;
  /** 提示文本 */
  tip?: string;
  /** 大小 */
  size?: 'small' | 'default' | 'large';
  /** 超时时间（毫秒），超时后展示可重新开始的说明；<= 0 表示不启用 */
  timeout?: number;
  /** 超时说明文本 */
  timeoutTip?: string;
  /** 重新开始按钮文本 */
  retryText?: string;
  /** 重新开始回调，传入后超时说明附带可点击的重新开始操作 */
  onRetry?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 加载指示器组件
 *
 * 全应用共用的唯一等待样式：同一种转圈 + 提示文本。
 * - 等待超过 timeout 后展示可重新开始的说明，传入 onRetry 时附带重新开始操作；
 * - 等待结束（loading 变为 false）或组件卸载时自动清理计时与超时提示，不会残留；
 * - 每个实例独立计时，多处等待同时出现时互不影响。
 * 页面、抽屉、弹窗中的等待都应使用本组件，保证表现一致。
 */
export function LoadingIndicator({
  loading = true,
  tip = '加载中…',
  size = 'default',
  timeout = DEFAULT_LOADING_TIMEOUT,
  timeoutTip = '等待时间较长，可能已卡住',
  retryText = '重新开始',
  onRetry,
  className = '',
}: LoadingIndicatorProps) {
  const visible = loading !== false;
  const [timedOut, setTimedOut] = useState(false);
  // 重新开始后递增，用于重新计时
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    // 等待结束（成功或取消）后重置超时提示，避免残留
    if (!visible || timeout <= 0) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), timeout);
    return () => clearTimeout(timer);
  }, [visible, timeout, cycle]);

  if (!visible) {
    return null;
  }

  const handleRetry = () => {
    // 清掉旧的超时提示并重新计时，再触发外部重试
    setTimedOut(false);
    setCycle((c) => c + 1);
    onRetry?.();
  };

  return (
    <div
      className={`loading-indicator loading-indicator-${size} ${className}`}
      role="status"
      aria-live="polite"
    >
      <Spin
        indicator={<LoadingOutlined style={{ fontSize: SPINNER_SIZES[size] }} spin />}
      />
      {tip && <span className="loading-indicator-tip">{tip}</span>}
      {timedOut && (
        <span className="loading-indicator-timeout">
          <span className="loading-indicator-timeout-text">{timeoutTip}</span>
          {onRetry && (
            <Button
              type="link"
              size="small"
              className="loading-indicator-retry"
              onClick={handleRetry}
            >
              {retryText}
            </Button>
          )}
        </span>
      )}
    </div>
  );
}
