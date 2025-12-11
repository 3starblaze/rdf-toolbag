import { create } from "zustand";

type Setter<T> = (val: T) => void;

export interface Store {
    pinnedUrl: URL | null,
    setPinnedUrl: Setter<URL | null>,
    pinnedRdfType: string | null,
    setPinnedRdfType: Setter<string | null>,
    pinnedArchetype: Set<string> | null,
    setPinnedArchetype: Setter<Set<string> | null>,
}

export const useStore = create<Store>((set) => ({
    pinnedUrl: null,
    setPinnedUrl: (val) => set(() => ({ pinnedUrl: val })),
    pinnedRdfType: null,
    setPinnedRdfType: (val) => set(() => ({ pinnedRdfType: val})),
    pinnedArchetype: null,
    setPinnedArchetype: (val) => set(() => ({ pinnedArchetype: val })),
}));
