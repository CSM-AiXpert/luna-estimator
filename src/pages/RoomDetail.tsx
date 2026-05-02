import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { trpc } from '@/providers/trpc';
import { paintScopeOptions, drywallRepairOptions, prepComplexityOptions, repairComplexityOptions, paintBrands, finishTypes } from '@/config';
import { ArrowLeft, Save, Camera, Sparkles, Palette, Ruler, ClipboardList, Check } from 'lucide-react';
import { fileToDataUrl } from '@/utils/ai';
import { computeRoomMetrics } from '@/utils/estimate';

export default function RoomDetail() {
  const { projectId, roomId } = useParams<{ projectId: string; roomId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const pid = Number(projectId);
  const rid = Number(roomId);

  const { data: room, isLoading } = trpc.rooms.get.useQuery({ id: rid });
  const updateRoom = trpc.rooms.update.useMutation({
    onSuccess: () => {
      utils.rooms.get.invalidate({ id: rid });
      utils.rooms.list.invalidate({ projectId: pid });
    },
  });
  const uploadMedia = trpc.media.upload.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate({ projectId: pid, roomId: rid });
      utils.rooms.get.invalidate({ id: rid });
      utils.rooms.list.invalidate({ projectId: pid });
    },
  });

  const [form, setForm] = useState({
    name: '', length: '', width: '', height: '',
    wallSqFt: '', ceilingSqFt: '', totalSqFt: '',
    doorCount: 0, windowCount: 0,
    trimLinearFt: '', baseboardLinearFt: '',
    hasDrywallRepair: [] as string[],
    paintScope: [] as string[],
    textureScope: [] as string[],
    prepComplexity: 'standard',
    repairComplexity: 'none',
    paintBrand: '', paintColor: '', paintColorCode: '',
    finishType: '', productLine: '', coats: 2,
    notes: '', internalNotes: '',
  });

  useEffect(() => {
    if (room) {
      setForm({
        name: room.name || '',
        length: room.length || '',
        width: room.width || '',
        height: room.height || '',
        wallSqFt: room.wallSqFt || '',
        ceilingSqFt: room.ceilingSqFt || '',
        totalSqFt: room.totalSqFt || '',
        doorCount: room.doorCount || 0,
        windowCount: room.windowCount || 0,
        trimLinearFt: room.trimLinearFt || '',
        baseboardLinearFt: room.baseboardLinearFt || '',
        hasDrywallRepair: room.hasDrywallRepair || [],
        paintScope: room.paintScope || [],
        textureScope: room.textureScope || [],
        prepComplexity: room.prepComplexity || 'standard',
        repairComplexity: room.repairComplexity || 'none',
        paintBrand: room.paintBrand || '',
        paintColor: room.paintColor || '',
        paintColorCode: room.paintColorCode || '',
        finishType: room.finishType || '',
        productLine: room.productLine || '',
        coats: room.coats || 2,
        notes: room.notes || '',
        internalNotes: room.internalNotes || '',
      });
    }
  }, [room]);

  const update = (updates: Partial<typeof form>) => {
    const newForm = { ...form, ...updates };
    setForm(newForm);
  };

  const metrics = computeRoomMetrics(form);
  const hasTrimScope = form.paintScope.some((scope) =>
    ['trim', 'doors', 'windows', 'baseboards', 'crown_molding'].includes(scope)
  );

  const save = () => {
    updateRoom.mutate({
      id: rid,
      name: form.name,
      length: form.length ? Number(form.length) : undefined,
      width: form.width ? Number(form.width) : undefined,
      height: form.height ? Number(form.height) : undefined,
      wallSqFt: metrics.wallSqFt || undefined,
      ceilingSqFt: metrics.ceilingSqFt || undefined,
      totalSqFt: metrics.totalSqFt || undefined,
      doorCount: form.doorCount,
      windowCount: form.windowCount,
      trimLinearFt: hasTrimScope && form.trimLinearFt ? Number(form.trimLinearFt) : undefined,
      baseboardLinearFt: form.baseboardLinearFt ? Number(form.baseboardLinearFt) : undefined,
      hasDrywallRepair: form.hasDrywallRepair,
      paintScope: form.paintScope,
      textureScope: form.textureScope,
      prepComplexity: form.prepComplexity,
      repairComplexity: form.repairComplexity,
      paintBrand: form.paintBrand || undefined,
      paintColor: form.paintColor || undefined,
      paintColorCode: form.paintColorCode || undefined,
      finishType: form.finishType || undefined,
      productLine: form.productLine || undefined,
      coats: form.coats,
      notes: form.notes || undefined,
      internalNotes: form.internalNotes || undefined,
    });
  };

  if (isLoading || !room) {
    return <div className="h-screen flex items-center justify-center bg-black text-[#555]">Loading...</div>;
  }

  const toggleArray = (field: 'hasDrywallRepair' | 'paintScope' | 'textureScope', value: string) => {
    const current = form[field];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [field]: next });
  };

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(`/project/${pid}/rooms`)} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <h1 className="text-sm font-semibold truncate max-w-[200px]">{form.name || room.name}</h1>
          </div>
          <button
            onClick={save}
            disabled={updateRoom.isPending}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-amber-400"
          >
            <Save className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-32">
        {/* Room Name */}
        <div className="mb-6">
          <input
            type="text"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full text-lg font-semibold bg-transparent border-b border-white/[0.08] pb-2 outline-none focus:border-amber-500/40 transition-colors"
          />
        </div>

        {/* Dimensions */}
        <Section title="Dimensions" icon={<Ruler className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Length (ft)" value={form.length} onChange={(v) => update({ length: v })} />
            <NumField label="Width (ft)" value={form.width} onChange={(v) => update({ width: v })} />
            <NumField label="Height (ft)" value={form.height} onChange={(v) => update({ height: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Wall Sq Ft" value={form.wallSqFt} onChange={(v) => update({ wallSqFt: v })} />
            <NumField label="Floor Sq Ft" value={metrics.floorSqFt ? String(metrics.floorSqFt) : ''} readOnly />
            <NumField label="Ceiling Sq Ft" value={form.ceilingSqFt} onChange={(v) => update({ ceilingSqFt: v })} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MetricCard label="Floor Total" value={metrics.floorSqFt} unit="sq ft" />
            <MetricCard label="Wall Total" value={metrics.wallSqFt} unit="sq ft" />
            <MetricCard label="Ceiling Total" value={metrics.ceilingSqFt} unit="sq ft" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <NumField label="Doors" value={String(form.doorCount)} onChange={(v) => update({ doorCount: Number(v) || 0 })} />
            <NumField label="Windows" value={String(form.windowCount)} onChange={(v) => update({ windowCount: Number(v) || 0 })} />
          </div>
        </Section>

        {/* Paint Scope */}
        <Section title="Paint Scope" icon={<Palette className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-2">
            {paintScopeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleArray('paintScope', opt.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  form.paintScope.includes(opt.value)
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-white/[0.04] text-[#888] border border-white/[0.08] hover:border-white/[0.15]'
                }`}
              >
                {form.paintScope.includes(opt.value) && <Check className="w-3 h-3 inline mr-1" />}
                {opt.label}
              </button>
            ))}
          </div>
          {hasTrimScope && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <NumField
                label="Total Trim Linear Ft"
                value={form.trimLinearFt}
                onChange={(v) => update({ trimLinearFt: v })}
                hint="Use one combined number for crown, casing, and detail trim."
              />
              <NumField
                label="Baseboard Linear Ft"
                value={form.baseboardLinearFt}
                onChange={(v) => update({ baseboardLinearFt: v })}
                hint="Track baseboards separately when you want separate estimate lines."
              />
            </div>
          )}
        </Section>

        {/* Drywall Repair */}
        <Section title="Drywall Repair" icon={<ClipboardList className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-2">
            {drywallRepairOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleArray('hasDrywallRepair', opt.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  form.hasDrywallRepair.includes(opt.value)
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-white/[0.04] text-[#888] border border-white/[0.08] hover:border-white/[0.15]'
                }`}
              >
                {form.hasDrywallRepair.includes(opt.value) && <Check className="w-3 h-3 inline mr-1" />}
                {opt.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">Prep Level</label>
              <select
                value={form.prepComplexity}
                onChange={(e) => update({ prepComplexity: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors appearance-none text-[#e0e0e0]"
              >
                {prepComplexityOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">Repair Level</label>
              <select
                value={form.repairComplexity}
                onChange={(e) => update({ repairComplexity: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors appearance-none text-[#e0e0e0]"
              >
                {repairComplexityOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        {/* Paint Selection */}
        <Section title="Paint Selection" icon={<Sparkles className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">Brand</label>
              <select
                value={form.paintBrand}
                onChange={(e) => update({ paintBrand: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors appearance-none text-[#e0e0e0]"
              >
                <option value="">Select brand</option>
                {paintBrands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">Finish</label>
              <select
                value={form.finishType}
                onChange={(e) => update({ finishType: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors appearance-none text-[#e0e0e0]"
              >
                <option value="">Select finish</option>
                {finishTypes.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">Color Name</label>
              <input
                type="text"
                value={form.paintColor}
                onChange={(e) => update({ paintColor: e.target.value })}
                placeholder="e.g. Repose Gray"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
              />
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">Color Code</label>
              <input
                type="text"
                value={form.paintColorCode}
                onChange={(e) => update({ paintColorCode: e.target.value })}
                placeholder="e.g. SW 7015"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">Product Line</label>
              <input
                type="text"
                value={form.productLine}
                onChange={(e) => update({ productLine: e.target.value })}
                placeholder="e.g. Duration Home"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
              />
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">Coats</label>
              <input
                type="number"
                value={form.coats}
                onChange={(e) => update({ coats: Number(e.target.value) || 1 })}
                min={1}
                max={4}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>
          </div>
        </Section>

        {/* Room Photos */}
        <Section title="Photos" icon={<Camera className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => navigate(`/project/${pid}/room/${rid}/visualize`)}
              className="aspect-square rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 flex flex-col items-center justify-center gap-1.5 hover:bg-amber-500/10 transition-colors"
            >
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-[10px] text-amber-400">LunaVis AI</span>
            </button>
            <label className="aspect-square rounded-xl border border-dashed border-white/[0.12] flex flex-col items-center justify-center gap-1.5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors cursor-pointer">
              <Camera className="w-5 h-5 text-[#555]" />
              <span className="text-[10px] text-[#555]">Add Photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void fileToDataUrl(file).then((dataUrl) => {
                    uploadMedia.mutate({
                      projectId: pid,
                      roomId: rid,
                      fileName: file.name,
                      contentType: file.type || 'image/jpeg',
                      dataUrl,
                      category: 'room-photo',
                      caption: file.name,
                      includeOnPdf: true,
                    });
                  });
                }}
              />
            </label>
            {(room.photos || []).slice(0, 1).map((photo: string, index: number) => (
              <div key={`${photo}-${index}`} className="aspect-square overflow-hidden rounded-xl border border-white/[0.08]">
                <img src={photo} alt={`Room photo ${index + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          {(room.photos || []).length > 1 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(room.photos || []).slice(1).map((photo: string, index: number) => (
                <div key={`${photo}-${index + 1}`} className="aspect-square overflow-hidden rounded-xl border border-white/[0.08]">
                  <img src={photo} alt={`Room photo ${index + 2}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Room-specific notes..."
            rows={3}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555] resize-none"
          />
        </Section>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
          <button
            onClick={() => navigate(`/project/${pid}/rooms`)}
            className="flex-1 py-3 rounded-xl border border-white/[0.1] text-sm font-medium text-[#888] hover:bg-white/5 transition-colors"
          >
            Back to Rooms
          </button>
          <button
            onClick={() => {
              save();
              navigate(`/project/${pid}/room/${rid}/visualize`);
            }}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            LunaVis AI
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-amber-400">{icon}</span>}
        <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  readOnly = false,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs text-[#888] mb-1.5 block">{label}</label>
      <input
        type="number"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
          readOnly
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            : 'bg-white/[0.04] border border-white/[0.08] focus:border-amber-500/40'
        }`}
      />
      {hint && <p className="mt-1 text-[10px] text-[#666]">{hint}</p>}
    </div>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-[#666]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#e8dcc9]">
        {value > 0 ? value.toLocaleString() : '-'}
        <span className="ml-1 text-xs font-medium text-[#888]">{unit}</span>
      </p>
    </div>
  );
}
