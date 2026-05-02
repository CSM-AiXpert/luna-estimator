import { useParams } from 'react-router';
import { trpc } from '@/providers/trpc';
import { ArrowLeft, Package, PaintBucket, Hammer, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router';
import { calculateMaterials, type MaterialCalc, toNumber } from '@/utils/estimate';

export default function MaterialsList() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const pid = Number(projectId);

  const { data: project } = trpc.projects.get.useQuery({ id: pid });
  const { data: rooms = [] } = trpc.rooms.list.useQuery({ projectId: pid });

  const materials = calculateMaterials(rooms);

  const byCategory: Record<string, MaterialCalc[]> = {};
  materials.forEach((m) => {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  });

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(`/project/${pid}/estimate`)} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <h1 className="text-sm font-semibold">Materials List</h1>
            <p className="text-[10px] text-[#888]">Internal Use Only</p>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-8">
        {/* Header */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-medium">{project?.customerName}</h2>
              <p className="text-xs text-[#888]">{rooms.length} rooms &middot; {materials.length} material items</p>
            </div>
          </div>
        </div>

        <RoomSummary
          rooms={rooms.length}
          walls={rooms.reduce((sum, room) => sum + toNumber(room.wallSqFt), 0)}
          ceilings={rooms.reduce((sum, room) => sum + toNumber(room.ceilingSqFt), 0)}
        />

        {/* Materials by Category */}
        {Object.entries(byCategory).map(([category, items]) => (
          <div key={category} className="mb-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              {category === 'Paint' && <PaintBucket className="w-3.5 h-3.5 text-amber-400" />}
              {category === 'Drywall' && <Hammer className="w-3.5 h-3.5 text-amber-400" />}
              {category === 'Supplies' && <Package className="w-3.5 h-3.5 text-amber-400" />}
              <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider">{category}</h3>
            </div>
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] text-amber-400 font-medium">
                    {Math.ceil(item.quantity)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-[10px] text-[#888]">{item.notes}</p>
                  </div>
                  <span className="text-xs text-[#888]">{item.unit}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {materials.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-[#333] mx-auto mb-3" />
            <p className="text-sm text-[#888]">Add room dimensions to generate materials</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RoomSummary({ walls, ceilings, rooms }: { walls: number; ceilings: number; rooms: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
        <p className="text-[10px] uppercase tracking-wider text-[#666]">Rooms</p>
        <p className="text-lg font-semibold text-amber-400">{rooms}</p>
      </div>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
        <p className="text-[10px] uppercase tracking-wider text-[#666]">Walls</p>
        <p className="text-lg font-semibold text-sky-400">{walls.toLocaleString()}</p>
      </div>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
        <p className="text-[10px] uppercase tracking-wider text-[#666]">Ceilings</p>
        <p className="text-lg font-semibold text-emerald-400">{ceilings.toLocaleString()}</p>
      </div>
    </div>
  );
}
