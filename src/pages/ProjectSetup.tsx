import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { trpc } from '@/providers/trpc';
import { propertyTypes, projectTypes } from '@/config';
import { ArrowLeft, ChevronRight, Upload, Sparkles, Camera, CheckCircle2, LoaderCircle, Wand2, FileText } from 'lucide-react';
import { fileToDataUrl, fileToText, isImageFile, isTextLikeFile } from '@/utils/ai';
import { calculateRoomCompletion, computeRoomMetrics } from '@/utils/estimate';

export default function ProjectSetup() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const id = Number(projectId);

  const { data: project, isLoading } = trpc.projects.get.useQuery({ id });
  const { data: rooms = [] } = trpc.rooms.list.useQuery({ projectId: id });
  const { data: projectMedia = [] } = trpc.media.list.useQuery({ projectId: id });
  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => utils.projects.get.invalidate({ id }),
  });
  const createRoom = trpc.rooms.create.useMutation({
    onSuccess: () => utils.rooms.list.invalidate({ projectId: id }),
  });
  const analyzeUpload = trpc.ai.analyzeProjectUpload.useMutation();
  const uploadMedia = trpc.media.upload.useMutation({
    onSuccess: () => utils.media.list.invalidate({ projectId: id }),
  });

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    propertyAddress: '',
    propertyType: '',
    projectType: '',
    notes: '',
    internalNotes: '',
    leadSource: '',
  });
  const [scanFileName, setScanFileName] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'analyzing' | 'ready'>('idle');
  const [scanSummary, setScanSummary] = useState('');
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [aiRooms, setAiRooms] = useState<Array<{
    name: string;
    length?: number;
    width?: number;
    height?: number;
    wallSqFt?: number;
    ceilingSqFt?: number;
    confidence: number;
    notes?: string | null;
  }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (project) {
      setForm({
        customerName: project.customerName || '',
        customerPhone: project.customerPhone || '',
        customerEmail: project.customerEmail || '',
        propertyAddress: project.propertyAddress || '',
        propertyType: project.propertyType || '',
        projectType: project.projectType || '',
        notes: project.notes || '',
        internalNotes: project.internalNotes || '',
        leadSource: project.leadSource || '',
      });
    }
  }, [project]);

  const handleUpdate = (updates: Partial<typeof form>) => {
    const newForm = { ...form, ...updates };
    setForm(newForm);
    updateMutation.mutate({
      id,
      ...updates,
    });
  };

  const projectCompletion = useMemo(() => {
    const dimensionsReady = rooms.filter((room) => computeRoomMetrics(room).totalSqFt > 0).length;
    const paintReady = rooms.filter((room) => calculateRoomCompletion(room).percent >= 60).length;
    return {
      totalRooms: rooms.length,
      dimensionsReady,
      paintReady,
    };
  }, [rooms]);

  const handlePolycamUpload = async (file: File) => {
    setScanFileName(file.name);
    setScanStatus('analyzing');
    setScanWarnings([]);
    setScanSummary('');
    try {
      const fileDataUrl = await fileToDataUrl(file);
      const fileText = isTextLikeFile(file) ? await fileToText(file) : undefined;
      const imageDataUrl = isImageFile(file) ? await fileToDataUrl(file) : undefined;
      await uploadMedia.mutateAsync({
        projectId: id,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        dataUrl: fileDataUrl,
        category: 'scan-upload',
        caption: `Project upload: ${file.name}`,
        includeOnPdf: false,
      });
      const result = await analyzeUpload.mutateAsync({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileText: fileText || undefined,
        imageDataUrl,
      });
      setAiRooms(result.rooms.map((room) => ({
        ...room,
        length: room.length ?? undefined,
        width: room.width ?? undefined,
        height: room.height ?? undefined,
        wallSqFt: room.wallSqFt ?? undefined,
        ceilingSqFt: room.ceilingSqFt ?? undefined,
      })));
      setScanSummary(result.summary || '');
      setScanWarnings(result.warnings || []);
      setScanStatus('ready');
    } catch (error) {
      setAiRooms([]);
      setScanWarnings([
        error instanceof Error ? error.message : 'Luna Vision AI analysis failed for this upload.',
      ]);
      setScanStatus('ready');
    }
  };

  const applySuggestedRooms = async () => {
    for (let i = 0; i < aiRooms.length; i += 1) {
      const room = aiRooms[i];
      const metrics = computeRoomMetrics(room);
      await createRoom.mutateAsync({
        projectId: id,
        name: room.name,
        sortOrder: rooms.length + i,
        length: room.length,
        width: room.width,
        height: room.height,
        wallSqFt: metrics.wallSqFt,
        ceilingSqFt: metrics.ceilingSqFt,
        totalSqFt: metrics.totalSqFt,
        paintScope: ['walls', 'ceiling'],
        coats: 2,
        notes: `Luna Vision AI suggested from scan upload ${scanFileName}`,
      });
    }
    setAiRooms([]);
  };

  const projectPhotos = projectMedia.filter((item) => item.category === 'project-photo');
  const projectDocuments = projectMedia.filter((item) => item.category === 'scan-upload');

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-black text-[#555]">Loading...</div>;
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black px-6 text-center text-[#e0e0e0]">
        <h1 className="text-lg font-semibold mb-2">Project not found</h1>
        <p className="text-sm text-[#888] mb-6">This estimate may have been deleted or the link is pointing to an old project id.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-sm font-medium text-white"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <h1 className="text-sm font-semibold">Project Setup</h1>
            <p className="text-[10px] text-[#888] font-mono">{project.estimateNumber}</p>
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
                i === 0 ? 'bg-amber-500 text-white' : 'bg-white/[0.06] text-[#555]'
              }`}>
                {i + 1}
              </div>
              <span className={`text-[10px] ${i === 0 ? 'text-amber-400' : 'text-[#555]'}`}>{step}</span>
              {i < 3 && <div className="flex-1 h-px bg-white/[0.06]" />}
            </div>
          ))}
        </div>

        {/* Polycam Upload Section */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium mb-1">Upload Polycam Scan</h3>
              <p className="text-xs text-[#888] mb-3">Import LiDAR scans, room measurements, or floor plans for Luna Vision AI-assisted room detection.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json,.csv,.pdf,.zip,.ply,.obj,.usdz,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handlePolycamUpload(file);
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Files
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] text-[#888] text-xs hover:bg-white/[0.1] transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  Take Photo
                </button>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-400">LunaVis AI</span>
            </div>
          </div>
          {(scanStatus !== 'idle' || aiRooms.length > 0) && (
            <div className="mt-4 rounded-xl bg-black/20 border border-white/[0.06] p-3">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs font-medium">{scanFileName || 'Pending upload'}</p>
                  <p className="text-[10px] text-[#888]">
                    {scanStatus === 'analyzing' && 'Luna Vision AI is analyzing surfaces, layout, and room suggestions'}
                    {scanStatus === 'ready' && `${aiRooms.length} Luna Vision AI room suggestions ready for review`}
                  </p>
                </div>
                {scanStatus === 'analyzing' && <LoaderCircle className="w-4 h-4 animate-spin text-amber-400" />}
                {scanStatus === 'ready' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>

              {aiRooms.length > 0 && (
                <div className="space-y-2">
                  {scanSummary && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-amber-300 mb-1">Luna Vision AI Summary</p>
                      <p className="text-xs text-[#d3c8bb]">{scanSummary}</p>
                    </div>
                  )}
                  {aiRooms.map((room) => (
                    <div key={room.name} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-sm font-medium">{room.name}</p>
                        <span className="text-[10px] text-amber-300">
                          {Math.round(room.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-[10px] text-[#888]">
                        {room.length || '-'} x {room.width || '-'} x {room.height || '-'} ft
                        {' · '}
                        {Math.round(room.wallSqFt || 0).toLocaleString()} wall sq ft
                      </p>
                      {room.notes && <p className="text-[10px] text-[#777] mt-1">{room.notes}</p>}
                    </div>
                  ))}
                  {scanWarnings.length > 0 && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                      {scanWarnings.map((warning) => (
                        <p key={warning} className="text-[10px] text-red-200">{warning}</p>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => void applySuggestedRooms()}
                    disabled={createRoom.isPending}
                    className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {createRoom.isPending ? 'Adding Suggested Rooms...' : 'Apply Suggested Rooms'}
                  </button>
                </div>
              )}
              {aiRooms.length === 0 && scanWarnings.length > 0 && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  {scanWarnings.map((warning) => (
                    <p key={warning} className="text-[10px] text-red-200">{warning}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer Info */}
        <Section title="Customer">
          <Field label="Name">
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => handleUpdate({ customerName: e.target.value })}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => handleUpdate({ customerPhone: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => handleUpdate({ customerEmail: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors"
              />
            </Field>
          </div>
        </Section>

        {/* Property */}
        <Section title="Property">
          <Field label="Address">
            <textarea
              value={form.propertyAddress}
              onChange={(e) => handleUpdate({ propertyAddress: e.target.value })}
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors resize-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Property Type">
              <select
                value={form.propertyType}
                onChange={(e) => handleUpdate({ propertyType: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors appearance-none text-[#e0e0e0]"
              >
                <option value="">Select</option>
                {propertyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Project Type">
              <select
                value={form.projectType}
                onChange={(e) => handleUpdate({ projectType: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors appearance-none text-[#e0e0e0]"
              >
                <option value="">Select</option>
                {projectTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <Field label="Customer-facing Notes">
            <textarea
              value={form.notes}
              onChange={(e) => handleUpdate({ notes: e.target.value })}
              placeholder="Notes that will appear on the estimate..."
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555] resize-none"
            />
          </Field>
          <Field label="Internal Notes">
            <textarea
              value={form.internalNotes}
              onChange={(e) => handleUpdate({ internalNotes: e.target.value })}
              placeholder="Internal-only notes..."
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555] resize-none"
            />
          </Field>
          <Field label="Lead Source">
            <input
              type="text"
              value={form.leadSource}
              onChange={(e) => handleUpdate({ leadSource: e.target.value })}
              placeholder="Referral, Google, etc."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
            />
          </Field>
        </Section>

        {/* Project Photos */}
        <Section title="Project Photos">
          <div className="grid grid-cols-3 gap-2">
            <input
              ref={projectPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void fileToDataUrl(file).then((dataUrl) =>
                  uploadMedia.mutate({
                    projectId: id,
                    fileName: file.name,
                    contentType: file.type || 'image/jpeg',
                    dataUrl,
                    category: 'project-photo',
                    caption: file.name,
                    includeOnPdf: true,
                  })
                );
              }}
            />
            <button
              onClick={() => projectPhotoInputRef.current?.click()}
              className="aspect-square rounded-xl border border-dashed border-white/[0.12] flex flex-col items-center justify-center gap-1.5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors"
            >
              <Camera className="w-5 h-5 text-[#555]" />
              <span className="text-[10px] text-[#555]">Add Photo</span>
            </button>
            {projectPhotos.map((photo) => (
              <div key={photo.id} className="aspect-square overflow-hidden rounded-xl border border-white/[0.08]">
                <img src={photo.url} alt={photo.caption || 'Project photo'} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          {projectDocuments.length > 0 && (
            <div className="mt-3 space-y-2">
              {projectDocuments.map((document) => (
                <a
                  key={document.id}
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{document.caption || 'Saved project document'}</p>
                    <p className="text-[10px] text-[#666]">Stored with the estimate record</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Section>

        <Section title="Field Readiness">
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Rooms" value={projectCompletion.totalRooms} accent="text-amber-400" />
            <MetricCard label="Measured" value={projectCompletion.dimensionsReady} accent="text-sky-400" />
            <MetricCard label="Paint-Ready" value={projectCompletion.paintReady} accent="text-emerald-400" />
          </div>
        </Section>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <button
            onClick={() => navigate(`/project/${id}/rooms`)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            Continue to Rooms
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#666]">{label}</p>
      <p className={`text-lg font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[#888] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
