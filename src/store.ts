import { create } from "zustand";

export interface Store {
    pinnedUrl: URL | null,
    setPinnedUrl: (val: URL | null) => void,
}

export const useStore = create<Store>((set) => ({
    pinnedUrl: null,
    setPinnedUrl: (val) => set(() => ({ pinnedUrl: val })),
}));
