import { create } from 'zustand';
import type { Project, Room, LineItem } from '@/types';

interface EstimatorStore {
  // Current working project
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // Rooms for current project
  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (id: number, updates: Partial<Room>) => void;
  removeRoom: (id: number) => void;

  // Line items for current project
  lineItems: LineItem[];
  setLineItems: (items: LineItem[]) => void;
  addLineItem: (item: LineItem) => void;
  updateLineItem: (id: number, updates: Partial<LineItem>) => void;
  removeLineItem: (id: number) => void;

  // Materials
  materials: Array<{ id: string; name: string; quantity: number; unit: string; notes: string; category: string }>;
  setMaterials: (materials: Array<{ id: string; name: string; quantity: number; unit: string; notes: string; category: string }>) => void;

  // UI State
  selectedRoomId: number | null;
  setSelectedRoomId: (id: number | null) => void;

  // Reset
  reset: () => void;
}

export const useEstimatorStore = create<EstimatorStore>((set) => ({
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  rooms: [],
  setRooms: (rooms) => set({ rooms }),
  addRoom: (room) => set((state) => ({ rooms: [...state.rooms, room] })),
  updateRoom: (id, updates) => set((state) => ({
    rooms: state.rooms.map((r) => (r.id === id ? { ...r, ...updates } : r)),
  })),
  removeRoom: (id) => set((state) => ({
    rooms: state.rooms.filter((r) => r.id !== id),
  })),

  lineItems: [],
  setLineItems: (items) => set({ lineItems: items }),
  addLineItem: (item) => set((state) => ({ lineItems: [...state.lineItems, item] })),
  updateLineItem: (id, updates) => set((state) => ({
    lineItems: state.lineItems.map((i) => (i.id === id ? { ...i, ...updates } : i)),
  })),
  removeLineItem: (id) => set((state) => ({
    lineItems: state.lineItems.filter((i) => i.id !== id),
  })),

  materials: [],
  setMaterials: (materials) => set({ materials }),

  selectedRoomId: null,
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),

  reset: () => set({
    currentProject: null,
    rooms: [],
    lineItems: [],
    materials: [],
    selectedRoomId: null,
  }),
}));
