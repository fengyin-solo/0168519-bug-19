import { Button, Spin } from 'antd';
import { LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import { useWaiting } from './useWaiting';
import './Waiting.css';

export type WaitingSize = 'small' | 'default' | 'large';

interface WaitingProps {
  /** 等待的唯一标识：不同等待使用不同 key，互不顶掉 */
  waitKey: string;
  /** 是否处于等待中；变为 false 时组件不渲染任何内容（成功即消失） */
  active: boolean;
  /** 等待中的提示文本 */
  tip?: string;
  /** 超时后的说明文本 */
  timeoutText?: string;
  /** 超时时长（毫秒），默认 20s */
  timeout?: number;
  /** 尺寸：small 用于行内/按钮旁，default 用于消息气泡，large 用于整页/弹窗 */
  size?: WaitingSize;
  /** 是否占满父容器居中（弹窗/抽屉/空内容区使用） */
  block?: boolean;
  /** 到达超时时长时的回调（可用于中止底层请求） */
  onTimeout?: () => void;
  /** 点击「重新开始」时的回调（重新发起请求） */
  onRetry?: () => void;
  /** 自定义类名 */
  className?: string;
}

const SPINNER_FONT_SIZE: Record<WaitingSize, number> = {
  small: 14,
  default: 18,
  large: 28,
};

/**
 * 全应用唯一的等待指示
 *
 * - 任何页面、弹窗里的等待都使用同一种转圈与提示样式
 * - 超过 timeout 仍未结束时，转圈替换为说明文本与「重新开始」按钮
 * - 不同 waitKey 的等待彼此独立；active 变为 false 后立即消失，不留残留
 */
export function Waiting({
  waitKey,
  active,
  tip = '请稍候…',
  timeoutText = '等待时间较长，可能是网络或服务异常，可以重新开始。',
  timeout,
  size = 'default',
  block = false,
  onTimeout,
  onRetry,
  className = '',
}: WaitingProps) {
  const { phase, retry } = useWaiting({
    key: waitKey,
    active,
    tip,
    timeoutText,
    timeout,
    onTimeout,
    onRetry,
  });

  // 未开始或已结束：不残留任何提示
  if (phase === 'idle') {
    return null;
  }

  const rootClass = [
    'waiting',
    `waiting-${size}`,
    block ? 'waiting-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (phase === 'timeout') {
    return (
      <div className={rootClass} role="status">
        <span className="waiting-timeout-text">{timeoutText}</span>
        {onRetry && (
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={retry}
            className="waiting-retry-btn"
          >
            重新开始
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <Spin
        indicator={
          <LoadingOutlined
            spin
            style={{ fontSize: SPINNER_FONT_SIZE[size] }}
          />
        }
      />
      <span className="waiting-tip">{tip}</span>
    </div>
  );
}
