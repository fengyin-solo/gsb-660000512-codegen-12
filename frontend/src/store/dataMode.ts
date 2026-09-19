import { create } from 'zustand';

export type DataMode = 'online' | 'local';

interface DataModeState {
  mode: DataMode;
  /** 切换到本地模式的时间，用于横幅提示 */
  localModeSince: string | null;
  /** 恢复在线后尚未处理的待同步操作数 */
  pendingCount: number;
  setMode: (mode: DataMode) => void;
  setPendingCount: (count: number) => void;
}

export const useDataModeStore = create<DataModeState>((set) => ({
  mode: 'online',
  localModeSince: null,
  pendingCount: 0,
  setMode: (mode) =>
    set((state) => ({
      mode,
      localModeSince: mode === 'local' ? (state.localModeSince || new Date().toISOString()) : null,
    })),
  setPendingCount: (pendingCount) => set({ pendingCount }),
}));
