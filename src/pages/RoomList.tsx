import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { trpc } from '@/providers/trpc';
import { useEstimatorStore } from '@/store/useEstimatorStore';
import { ArrowLeft, Plus, ChevronRight, Wand2, BedDouble, CookingPot, Bath, DoorOpen, Maximize, Sofa, Boxes } from 'lucide-react';
import { calculateRoomCompletion } from '@/utils/estimate';

const roomIcons: Record<string, React.ReactNode> = {
  'bedroom': <BedDouble className="w-5 h-5" />,
  'kitchen': <CookingPot className="w-5 h-5" />,
  'bathroom': <Bath className="w-5 h-5" />,
  'hallway': <DoorOpen className="w-5 h-5" />,
  'living': <Sofa className="w-5 h-5" />,
  'default': <Maximize className="w-5 h-5" />,
};

const roomPresets = [
  { name: 'Living Room', type: 'living' },
  { name: 'Kitchen', type: 'kitchen' },
  { name: 'Primary Bedroom', type: 'bedroom' },
  { name: 'Bedroom 2', type: 'bedroom' },
  { name: 'Bedroom 3', type: 'bedroom' },
  { name: 'Bathroom 1', type: 'bathroom' },
  { name: 'Bathroom 2', type: 'bathroom' },
  { name: 'Hallway', type: 'hallway' },
  { name: 'Dining Room', type: 'living' },
  { name: 'Office', type: 'bedroom' },
  { name: 'Laundry', type: 'default' },
  { name: 'Entryway', type: 'hallway' },
];

export default function RoomList() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const id = Number(projectId);
  const setSelectedRoomId = useEstimatorStore((s) => s.setSelectedRoomId);

  const { data: rooms = [] } = trpc.rooms.list.useQuery({ projectId: id });
  const createRoom = trpc.rooms.create.useMutation({
    onSuccess: () => utils.rooms.list.invalidate({ projectId: id }),
  });

  const [customName, setCustomName] = useState('');

  const addRoom = (name: string) => {
    createRoom.mutate({
      projectId: id,
      name,
      sortOrder: rooms.length,
      paintScope: ['walls'],
      coats: 2,
    });
  };

  const getIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('bed')) return roomIcons.bedroom;
    if (lower.includes('kitchen')) return roomIcons.kitchen;
    if (lower.includes('bath')) return roomIcons.bathroom;
    if (lower.includes('hall')) return roomIcons.hallway;
    if (lower.includes('living') || lower.includes('dining') || lower.includes('family')) return roomIcons.living;
    return roomIcons.default;
  };

  const totalSqFt = rooms.reduce((sum, r) => sum + Number(r.totalSqFt || 0), 0);

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(`/project/${id}/setup`)} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <h1 className="text-sm font-semibold">Rooms</h1>
            <p className="text-[10px] text-[#888]">{rooms.length} rooms &middot; {totalSqFt.toLocaleString()} sq ft</p>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-32">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6 px-1">
          {['Setup', 'Rooms', 'Estimate', 'Review'].map((step, i) => (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                i === 1 ? 'bg-amber-500 text-white' : 'bg-white/[0.06] text-[#555]'
              }`}>
                {i + 1}
              </div>
              <span className={`text-[10px] ${i === 1 ? 'text-amber-400' : 'text-[#555]'}`}>{step}</span>
              {i < 3 && <div className="flex-1 h-px bg-white/[0.06]" />}
            </div>
          ))}
        </div>

        {/* Luna Vision AI Suggestion */}
        {rooms.length === 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <Wand2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">Luna Vision AI Room Detection</h3>
                <p className="text-xs text-[#888]">Upload a floor plan or describe the property to auto-generate rooms with estimated dimensions.</p>
              </div>
            </div>
          </div>
        )}

        {/* Room List */}
        {rooms.length === 0 ? (
          <div className="text-center py-12">
            <Boxes className="w-12 h-12 text-[#333] mx-auto mb-3" />
            <p className="text-sm text-[#888] mb-1">No rooms added yet</p>
            <p className="text-xs text-[#555] mb-4">Add rooms to build your estimate</p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {rooms.map((room, idx) => (
              <button
                key={room.id}
                onClick={() => {
                  setSelectedRoomId(room.id);
                  navigate(`/project/${id}/room/${room.id}`);
                }}
                className="w-full text-left flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-amber-400/70">
                  {getIcon(room.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{room.name}</h3>
                    <span className="text-[10px] text-[#555] font-mono">#{idx + 1}</span>
                    <span className="text-[10px] text-emerald-300">
                      {calculateRoomCompletion(room).percent}% ready
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[#888]">
                    {room.totalSqFt && <span>{Number(room.totalSqFt).toLocaleString()} sq ft</span>}
                    {room.paintScope && room.paintScope.length > 0 && (
                      <span>{room.paintScope.join(', ')}</span>
                    )}
                    {room.coats && <span>{room.coats} coats</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {room.subtotal && Number(room.subtotal) > 0 && (
                    <span className="text-xs font-medium text-amber-400">${Number(room.subtotal).toLocaleString()}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-[#555]" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Add Room Section */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
          <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-3">Quick Add Rooms</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {roomPresets.slice(0, 8).map((preset) => (
              <button
                key={preset.name}
                onClick={() => addRoom(preset.name)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors"
              >
                <Plus className="w-3 h-3 text-amber-400" />
                {preset.name}
              </button>
            ))}
          </div>

          {/* Custom Room */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customName.trim()) {
                  addRoom(customName.trim());
                  setCustomName('');
                }
              }}
              placeholder="Custom room name..."
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
            />
            <button
              onClick={() => {
                if (customName.trim()) {
                  addRoom(customName.trim());
                  setCustomName('');
                }
              }}
              disabled={!customName.trim()}
              className="px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-30"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
          <button
            onClick={() => navigate(`/project/${id}/setup`)}
            className="flex-1 py-3 rounded-xl border border-white/[0.1] text-sm font-medium text-[#888] hover:bg-white/5 transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => navigate(`/project/${id}/estimate`)}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            Continue to Estimate
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
