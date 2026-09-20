import { create } from 'zustand';

/**
 * 等待状态
 * - waiting：进行中，展示统一的等待指示
 * - timeout：超过约定时长仍无结果，展示说明与「重新开始」入口
 */
export type WaitingPhase = 'waiting' | 'timeout';

export interface WaitingEntry {
  /** 等待中的标识 */
  key: string;
  /** 当前阶段 */
  phase: WaitingPhase;
  /** 等待中的提示文本 */
  tip: string;
  /** 超时后的说明文本 */
  timeoutText: string;
}

interface WaitingState {
  /** 所有进行中的等待（按键隔离，互不顶掉） */
  entries: Record<string, WaitingEntry>;
  /** 开始一个等待；同名 key 重复开始会被忽略，保证后到的等待不覆盖先到的 */
  begin: (key: string, tip?: string, timeoutText?: string) => void;
  /** 标记超时（等待不存在时为空操作，避免成功后残留提示） */
  markTimeout: (key: string) => void;
  /** 从超时恢复为等待中并重新计时（「重新开始」时使用） */
  restart: (key: string, tip?: string, timeoutText?: string) => void;
  /** 结束并清除等待（成功或主动放弃时调用） */
  end: (key: string) => void;
  /** 读取单个等待（供非 React 环境使用） */
  getEntry: (key: string) => WaitingEntry | undefined;
}

const DEFAULT_TIP = '请稍候…';
const DEFAULT_TIMEOUT_TEXT = '等待时间较长，可能是网络或服务异常，可以重新开始。';

export const useWaitingStore = create<WaitingState>((set, get) => ({
  entries: {},

  begin: (key, tip = DEFAULT_TIP, timeoutText = DEFAULT_TIMEOUT_TEXT) => {
    // 已存在同 key 的等待时不覆盖：两种等待同时出现时各自独立
    if (get().entries[key]) {
      return;
    }
    set((state) => ({
      entries: {
        ...state.entries,
        [key]: { key, phase: 'waiting', tip, timeoutText },
      },
    }));
  },

  markTimeout: (key) => {
    set((state) => {
      const entry = state.entries[key];
      if (!entry || entry.phase !== 'waiting') {
        return state;
      }
      return {
        entries: {
          ...state.entries,
          [key]: { ...entry, phase: 'timeout' },
        },
      };
    });
  },

  restart: (key, tip = DEFAULT_TIP, timeoutText = DEFAULT_TIMEOUT_TEXT) => {
    set((state) => ({
      entries: {
        ...state.entries,
        [key]: { key, phase: 'waiting', tip, timeoutText },
      },
    }));
  },

  end: (key) => {
    set((state) => {
      if (!state.entries[key]) {
        return state;
      }
      const entries = { ...state.entries };
      delete entries[key];
      return { entries };
    });
  },

  getEntry: (key) => get().entries[key],
}));

/** 等待的默认超时时长（毫秒） */
export const DEFAULT_WAITING_TIMEOUT = 20_000;
