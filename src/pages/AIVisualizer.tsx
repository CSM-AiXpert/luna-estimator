import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { trpc } from '@/providers/trpc';
import { paintBrands } from '@/config';
import { ArrowLeft, Sparkles, Wand2, Upload, Camera, CheckCircle2 } from 'lucide-react';
import { fileToDataUrl, urlToDataUrl } from '@/utils/ai';

const colorPresets = [
  { name: 'Repose Gray', code: 'SW 7015', hex: '#CCCBCD' },
  { name: 'Agreeable Gray', code: 'SW 7029', hex: '#D4CFC7' },
  { name: 'Alabaster', code: 'SW 7008', hex: '#EDEAE0' },
  { name: 'Pure White', code: 'SW 7005', hex: '#EBECE6' },
  { name: 'Naval', code: 'SW 6244', hex: '#2E3A59' },
  { name: 'Hale Navy', code: 'HC-154', hex: '#434B4F' },
  { name: 'Sage', code: 'SW 6164', hex: '#9CAF88' },
  { name: 'Sea Salt', code: 'SW 6204', hex: '#CDD3C9' },
  { name: 'Accessible Beige', code: 'SW 7036', hex: '#D4C8B8' },
  { name: 'Mindful Gray', code: 'SW 7016', hex: '#B5B5B1' },
  { name: 'Iron Ore', code: 'SW 7069', hex: '#464341' },
  { name: 'Tricorn Black', code: 'SW 6258', hex: '#2D2D2D' },
];

export default function AIVisualizer() {
  const { projectId, roomId } = useParams<{ projectId: string; roomId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const pid = Number(projectId);
  const rid = Number(roomId);

  const { data: room, isLoading: isRoomLoading } = trpc.rooms.get.useQuery({ id: rid });
  const updateRoom = trpc.rooms.update.useMutation({
    onSuccess: () => {
      utils.rooms.get.invalidate({ id: rid });
      utils.rooms.list.invalidate({ projectId: pid });
    },
  });
  const generateVisualization = trpc.ai.generateRoomVisualization.useMutation();
  const uploadMedia = trpc.media.upload.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate({ projectId: pid, roomId: rid });
      utils.rooms.get.invalidate({ id: rid });
      utils.rooms.list.invalidate({ projectId: pid });
    },
  });

  const [selectedColor, setSelectedColor] = useState(colorPresets[0]);
  const [selectedTrimColor, setSelectedTrimColor] = useState(colorPresets[3]);
  const [customColor, setCustomColor] = useState('');
  const [customTrimColor, setCustomTrimColor] = useState('');
  const [paintBrand, setPaintBrand] = useState('Sherwin-Williams');
  const [sourcePhoto, setSourcePhoto] = useState<string | null>(room?.photos?.[0] || null);
  const [generatedImages, setGeneratedImages] = useState<Array<{ url: string; label: string }>>(
    room?.aiVisualizationUrl ? [{ url: room.aiVisualizationUrl, label: 'Saved Variation' }] : []
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(room?.aiVisualizationUrl || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Ready to generate');
  const [promptSummary, setPromptSummary] = useState('');
  const activeColor = useMemo(() => {
    if (customColor.trim()) {
      return { name: customColor.trim(), code: customColor.trim(), hex: selectedColor.hex };
    }
    return selectedColor;
  }, [customColor, selectedColor]);
  const activeTrimColor = useMemo(() => {
    if (customTrimColor.trim()) {
      return { name: customTrimColor.trim(), code: customTrimColor.trim(), hex: selectedTrimColor.hex };
    }
    return selectedTrimColor;
  }, [customTrimColor, selectedTrimColor]);

  useEffect(() => {
    if (room?.photos?.[0] && !sourcePhoto) {
      setSourcePhoto(room.photos[0]);
    }
    if (room?.aiVisualizationUrl && generatedImages.length === 0) {
      setGeneratedImages([{ url: room.aiVisualizationUrl, label: 'Saved Variation' }]);
    }
    if (room?.aiVisualizationUrl && !selectedImage) {
      setSelectedImage(room.aiVisualizationUrl);
    }
  }, [generatedImages.length, room, selectedImage, sourcePhoto]);

  const startProgress = () => {
    setProgress(6);
    setStatusMessage('Upload received');
  };

  const finishProgress = (message: string) => {
    setProgress(100);
    setStatusMessage(message);
  };

  const handleGenerate = async () => {
    if (!sourcePhoto) {
      setStatusMessage('Attach a room photo first to generate Luna Vision AI previews');
      return;
    }

    setIsGenerating(true);
    startProgress();
    try {
      setProgress(18);
      setStatusMessage('Preparing room surfaces and paint instructions');
      const result = await generateVisualization.mutateAsync({
        sourceImage: sourcePhoto,
        paintBrand,
        paintColorName: activeColor.name,
        paintColorCode: activeColor.code,
        trimColorName: activeTrimColor.name,
        trimColorCode: activeTrimColor.code,
        colorHex: activeColor.hex,
        trimColorHex: activeTrimColor.hex,
        roomContext: room?.name ? `${room.name} repaint preview` : undefined,
        variationStyle: 'premium repaint',
      });
      setProgress(62);
      setStatusMessage('Rendering Luna Vision AI color variations');

      const primaryImage = result.images[0]?.url
        ? (result.images[0].url.startsWith('data:') ? result.images[0].url : await urlToDataUrl(result.images[0].url))
        : null;

      setProgress(86);
      setStatusMessage('Saving the selected preview to this room');

      if (primaryImage) {
        await uploadMedia.mutateAsync({
          projectId: pid,
          roomId: rid,
          fileName: `${room?.name || 'room'}-luna-vision-ai.png`,
          contentType: 'image/png',
          dataUrl: primaryImage,
          category: 'ai-generated',
          caption: `${activeColor.name}${activeTrimColor.name ? ` / ${activeTrimColor.name}` : ''}`,
          includeOnPdf: true,
        });
      }

      setGeneratedImages(result.images);
      setSelectedImage(result.images[0]?.url || null);
      setPromptSummary(result.promptSummary || '');
      updateRoom.mutate({
        id: rid,
        paintBrand,
        paintColor: activeColor.name,
        paintColorCode: activeColor.code,
        notes: `Walls: ${activeColor.name}${activeColor.code ? ` (${activeColor.code})` : ''} · Trim: ${activeTrimColor.name}${activeTrimColor.code ? ` (${activeTrimColor.code})` : ''}`,
        photos: sourcePhoto ? Array.from(new Set([sourcePhoto, ...(room?.photos || [])])) : room?.photos || undefined,
        aiVisualizationUrl: primaryImage || result.images[0]?.url || undefined,
      });
      finishProgress('Complete');
    } catch (error) {
      setGeneratedImages([]);
      setSelectedImage(null);
      setPromptSummary('');
      finishProgress(error instanceof Error ? error.message : 'Luna Vision AI failed');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isRoomLoading) {
    return <div className="h-screen flex items-center justify-center bg-black text-[#555]">Loading...</div>;
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black px-6 text-center text-[#e0e0e0]">
        <h1 className="text-lg font-semibold mb-2">Room not found</h1>
        <p className="text-sm text-[#888] mb-6">Open the room list again and choose an active room before launching Luna Vision AI.</p>
        <button
          onClick={() => navigate(`/project/${pid}/rooms`)}
          className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-sm font-medium text-white"
        >
          Return to Rooms
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(`/project/${pid}/room/${rid}`)} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <h1 className="text-sm font-semibold">Luna Vision AI</h1>
            <p className="text-[10px] text-[#888]">{room?.name}</p>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-32">
        {/* Preview Area */}
        <div className="mb-6 aspect-video rounded-2xl bg-[#111] border border-white/[0.06] overflow-hidden relative">
          {selectedImage ? (
            <img src={selectedImage} alt="Luna Vision AI visualization" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-400/50" />
              </div>
              <p className="text-sm text-[#888]">Upload a room photo, choose a color, and generate with Luna Vision AI</p>
            </div>
          )}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <div className="w-full max-w-sm px-6">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/55 p-5">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-amber-400">Luna Vision AI is generating</span>
                  <div className="w-full">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-[#bca48d]">
                      <span>{statusMessage}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#d7d7d7]">Luna Vision AI Status</p>
              <p className="text-[10px] text-[#888]">{statusMessage}</p>
            </div>
            {progress === 100 && generatedImages.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ready
              </div>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {promptSummary && (
            <p className="mt-3 text-[11px] text-[#9f9f9f]">
              {promptSummary}
            </p>
          )}
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-3">Source Room Photo</h3>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 hover:border-white/[0.12] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium">{sourcePhoto ? 'Room photo attached' : 'Attach room photo'}</p>
                <p className="text-[10px] text-[#888]">Use a site photo so the visualizer keeps the same layout and perspective.</p>
              </div>
            </div>
            <Upload className="w-4 h-4 text-[#888]" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void fileToDataUrl(file).then((dataUrl) => {
                  setSourcePhoto(dataUrl);
                  setStatusMessage('Room photo attached. Select a color and generate.');
                  setProgress(0);
                });
              }}
            />
          </label>
        </div>

        {/* Color Selection */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-3">Wall Paint Color</h3>
          <div className="grid grid-cols-4 gap-2">
            {colorPresets.map((color) => (
              <button
                key={color.code}
                onClick={() => setSelectedColor(color)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                  selectedColor.code === color.code
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-lg border border-white/[0.1]"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-[9px] text-[#888] text-center leading-tight">{color.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Wall Color */}
        <div className="mb-6">
          <label className="text-xs text-[#888] mb-1.5 block">Custom Wall Color</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              placeholder="Enter color name or code"
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
            />
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-3">Trim Paint Color</h3>
          <div className="grid grid-cols-4 gap-2">
            {colorPresets.map((color) => (
              <button
                key={`trim-${color.code}`}
                onClick={() => setSelectedTrimColor(color)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                  selectedTrimColor.code === color.code
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-lg border border-white/[0.1]"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-[9px] text-[#888] text-center leading-tight">{color.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs text-[#888] mb-1.5 block">Custom Trim Color</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customTrimColor}
              onChange={(e) => setCustomTrimColor(e.target.value)}
              placeholder="Enter trim color name or code"
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
            />
          </div>
        </div>

        {/* Paint Brand */}
        <div className="mb-6">
          <label className="text-xs text-[#888] mb-1.5 block">Paint Brand</label>
          <select
            value={paintBrand}
            onChange={(e) => setPaintBrand(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors appearance-none text-[#e0e0e0]"
          >
            {paintBrands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Selected Color Info */}
        <div className="mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl border border-white/[0.1]"
              style={{ backgroundColor: selectedColor.hex }}
            />
            <div>
              <p className="text-sm font-medium">{activeColor.name}</p>
              <p className="text-xs text-[#888]">Walls: {activeColor.code} &middot; Trim: {activeTrimColor.name} {activeTrimColor.code}</p>
            </div>
          </div>
        </div>

        {generatedImages.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-3">Variations</h3>
            <div className="grid grid-cols-3 gap-2">
              {generatedImages.map((image, index) => (
                <button
                  key={image.url}
                  onClick={() => {
                    setSelectedImage(image.url);
                    updateRoom.mutate({ id: rid, aiVisualizationUrl: image.url });
                  }}
                  className={`relative overflow-hidden rounded-xl border ${
                    selectedImage === image.url ? 'border-amber-500/60' : 'border-white/[0.08]'
                  }`}
                >
                  <img src={image.url} alt={`Variation ${index + 1}`} className="aspect-video w-full object-cover" />
                  <span className="absolute inset-x-2 bottom-2 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white">
                    {image.label || `Variation ${index + 1}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
          <button
            onClick={() => navigate(`/project/${pid}/room/${rid}`)}
            className="flex-1 py-3 rounded-xl border border-white/[0.1] text-sm font-medium text-[#888] hover:bg-white/5 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !sourcePhoto}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4" />
            {isGenerating ? 'Generating...' : 'Generate Variations'}
          </button>
        </div>
      </div>
    </div>
  );
}
