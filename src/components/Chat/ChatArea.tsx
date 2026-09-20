import { useCallback, useRef, useState } from 'react';
import { message } from 'antd';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { sendMessageStream } from '../../services/api';
import { createStreamHandler, toMessageStats } from '../../services/stream';
import { parseError, logError, shouldShowConfigPanel } from '../../services/errorHandler';
import { useUIStore } from '../../stores/uiStore';
import type { APIMessage } from '../../types';
import './ChatArea.css';

// 创建流处理器实例
const streamHandler = createStreamHandler();

/**
 * 聊天区域主组件
 */
export function ChatArea() {
  const {
    activeConversationId,
    isStreaming,
    streamingMessageId,
    getActiveConversation,
    addMessage,
    startStreaming,
    appendStreamContent,
    finishStreaming,
    cancelStreaming,
    discardMessage,
    createConversation,
  } = useChatStore();

  const { config, isValid: isConfigValid } = useConfigStore();
  const { setConfigPanelVisible } = useUIStore();

  // 发送中（请求已发出、首个内容分片到达之前）
  const [isSending, setIsSending] = useState(false);
  // 标识最新一次请求，旧请求的迟到回调一律丢弃
  const requestSeqRef = useRef(0);

  const conversation = getActiveConversation();
  const messages = conversation?.messages || [];

  /**
   * 发起一次流式请求（首次发送与超时后重新开始共用）
   */
  const runStreamRequest = useCallback(
    async (apiMessages: APIMessage[], seq: number) => {
      const isCurrent = () => requestSeqRef.current === seq;

      const handleFailure = (error: unknown, context: string) => {
        if (!isCurrent()) return;
        setIsSending(false);
        const appError = parseError(error);
        logError(appError, context);
        message.error(appError.message);
        cancelStreaming();

        if (shouldShowConfigPanel(appError)) {
          setConfigPanelVisible(true);
        }
      };

      try {
        const stream = sendMessageStream(apiMessages, {
          ...config,
          stream: true,
        });

        await streamHandler.start(stream, {
          onChunk: (chunk) => {
            if (!isCurrent()) return;
            // 首个分片到达：发送中结束，进入流式回复
            setIsSending(false);
            appendStreamContent(chunk);
          },
          onComplete: (stats) => {
            if (!isCurrent()) return;
            setIsSending(false);
            finishStreaming(toMessageStats(stats));
          },
          onError: (error) => handleFailure(error, 'ChatArea.runStreamRequest'),
        });
      } catch (error) {
        handleFailure(error, 'ChatArea.handleSend');
      }
    },
    [
      config,
      appendStreamContent,
      finishStreaming,
      cancelStreaming,
      setConfigPanelVisible,
    ]
  );

  /**
   * 重新开始一次请求：可选丢弃旧的流式占位，沿用上一条用户消息
   */
  const restartRequest = useCallback(
    async (
      conversationId: string,
      priorMessages: APIMessage[],
      lastUserContent: string,
      staleMessageId?: string,
    ) => {
      const seq = ++requestSeqRef.current;
      streamHandler.abort();
      if (staleMessageId) {
        discardMessage(conversationId, staleMessageId);
      }

      const apiMessages: APIMessage[] = [
        ...priorMessages,
        { role: 'user' as const, content: lastUserContent },
      ];

      startStreaming(conversationId);
      setIsSending(true);
      await runStreamRequest(apiMessages, seq);
    },
    [discardMessage, runStreamRequest, startStreaming]
  );

  const handleSend = useCallback(
    async (content: string) => {
      if (!isConfigValid) {
        message.warning('请先配置 API Key');
        setConfigPanelVisible(true);
        return;
      }

      // 如果没有活动对话，自动创建一个
      let conversationId = activeConversationId;
      if (!conversationId) {
        conversationId = createConversation();
      }

      // 获取当前对话的历史消息（在添加新消息之前）
      const stateBeforeAdd = useChatStore.getState();
      const currentConversation = stateBeforeAdd.conversations.find(c => c.id === conversationId);
      const historyMessages = currentConversation?.messages || [];

      // 添加用户消息
      addMessage(conversationId, {
        role: 'user',
        content,
        status: 'complete',
      });

      // 准备 API 消息（历史消息 + 当前消息）
      const apiMessages: APIMessage[] = [
        ...historyMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user' as const, content },
      ];

      // 开始流式响应
      startStreaming(conversationId);

      const seq = ++requestSeqRef.current;
      setIsSending(true);
      await runStreamRequest(apiMessages, seq);
    },
    [
      activeConversationId,
      isConfigValid,
      addMessage,
      startStreaming,
      createConversation,
      runStreamRequest,
      setConfigPanelVisible,
    ]
  );

  /**
   * 重新开始指定的回复：丢弃卡住的占位，沿用上一条用户消息重新请求
   */
  const handleRetryMessage = useCallback(
    async (failedMessageId: string) => {
      const state = useChatStore.getState();
      const targetConversation =
        state.conversations.find((c) =>
          c.messages.some((m) => m.id === failedMessageId),
        ) || null;
      if (!targetConversation) return;

      // 找到占位消息之前最后一条用户消息
      const failedIndex = targetConversation.messages.findIndex((m) => m.id === failedMessageId);
      const priorMessages = targetConversation.messages
        .slice(0, failedIndex)
        .map((msg) => ({ role: msg.role, content: msg.content }));
      const lastUserMessage = [...priorMessages].reverse().find((m) => m.role === 'user');
      if (!lastUserMessage) return;

      await restartRequest(
        targetConversation.id,
        priorMessages,
        lastUserMessage.content,
        failedMessageId,
      );
    },
    [restartRequest]
  );

  /**
   * 发送中超时后的重新开始：重发当前对话最后一条用户消息
   */
  const handleRetrySend = useCallback(async () => {
    const state = useChatStore.getState();
    const current = state.conversations.find((c) => c.id === state.activeConversationId);
    if (!current || !state.activeConversationId) {
      setIsSending(false);
      cancelStreaming();
      return;
    }

    // 历史消息排除流式占位；最后一条用户消息作为重发内容
    const priorMessages = current.messages
      .filter((m) => m.id !== state.streamingMessageId)
      .map((msg) => ({ role: msg.role, content: msg.content }));
    const lastUserMessage = [...priorMessages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      setIsSending(false);
      cancelStreaming();
      return;
    }

    await restartRequest(
      current.id,
      priorMessages.slice(0, -1),
      lastUserMessage.content,
      state.streamingMessageId ?? undefined,
    );
  }, [cancelStreaming, restartRequest]);

  const handleStop = useCallback(() => {
    requestSeqRef.current++;
    streamHandler.abort();
    setIsSending(false);
    cancelStreaming();
    message.info('已停止响应');
  }, [cancelStreaming]);

  return (
    <div className="chat-area">
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingMessageId={streamingMessageId}
        onRetryMessage={handleRetryMessage}
      />
      <InputArea
        onSend={handleSend}
        onStop={handleStop}
        isLoading={isSending}
        isStreaming={isStreaming}
        disabled={false}
        onRetrySend={handleRetrySend}
      />
    </div>
  );
}
