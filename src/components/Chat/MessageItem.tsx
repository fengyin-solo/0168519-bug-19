import { memo } from 'react';
import { Avatar } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import type { Message } from '../../types';
import { MarkdownRenderer } from '../Common/MarkdownRenderer';
import { CopyButton } from '../Common/CopyButton';
import { Waiting } from '../Common/Waiting';
import { formatResponseTime, formatTokenCount } from '../../utils/formatters';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  /** 重新开始本次回复（超时后点击「重新开始」触发） */
  onRetry?: () => void;
}

/**
 * 消息项组件
 */
export const MessageItem = memo(function MessageItem({
  message,
  isStreaming = false,
  onRetry,
}: MessageItemProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const showStats = isAssistant && message.status === 'complete' && message.stats;
  // 触发时机与摆放保持不变：仅流式消息尚无内容时，在气泡内展示等待
  const waitingForReply = isStreaming && message.status === 'streaming' && !message.content;

  return (
    <div className={`message-item ${isUser ? 'user' : 'assistant'} animate-fadeInUp`}>
      <div className="message-avatar">
        <Avatar
          size={36}
          icon={isUser ? <UserOutlined /> : <RobotOutlined />}
          style={{
            backgroundColor: isUser ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
            color: isUser ? 'white' : 'var(--color-text-secondary)',
          }}
        />
      </div>

      <div className="message-content-wrapper">
        <div className={`message-bubble ${message.status}`}>
          {waitingForReply ? (
            <Waiting
              waitKey={`reply-${message.id}`}
              active
              size="default"
              tip="正在等待回复…"
              timeoutText="回复等待时间较长，可能是网络或服务异常，可以重新开始。"
              onRetry={onRetry}
            />
          ) : (
            <div className="message-content">
              {isUser ? (
                <p>{message.content}</p>
              ) : (
                <MarkdownRenderer content={message.content} />
              )}
            </div>
          )}

          {message.status === 'error' && (
            <div className="message-error">
              <span>消息发送失败</span>
            </div>
          )}
        </div>

        <div className="message-footer">
          {showStats && message.stats && (
            <div className="message-stats">
              <span className="stat-item">
                {formatResponseTime(message.stats.responseTime)}
              </span>
              <span className="stat-divider">·</span>
              <span className="stat-item">
                {formatTokenCount(message.stats.tokenCount)} tokens
              </span>
            </div>
          )}

          {isAssistant && message.content && message.status === 'complete' && (
            <div className="message-actions">
              <CopyButton text={message.content} size="small" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
