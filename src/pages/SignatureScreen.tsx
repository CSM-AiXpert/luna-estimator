import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { trpc } from '@/providers/trpc';
import { ArrowLeft, RotateCcw, Check, X, Download, Send } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { formatCurrency } from '@/utils/estimate';

export default function SignatureScreen() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const pid = Number(projectId);

  const { data: project } = trpc.projects.get.useQuery({ id: pid });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate({ id: pid });
      utils.projects.list.invalidate();
    },
  });
  const uploadMedia = trpc.media.upload.useMutation({
    onSuccess: () => utils.media.list.invalidate({ projectId: pid }),
  });
  const syncProject = trpc.sync.projectToGhl.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate({ id: pid });
      utils.projects.list.invalidate();
    },
  });

  const [customerName, setCustomerName] = useState('');
  const [estimatorName, setEstimatorName] = useState('');
  const [step, setStep] = useState<'customer' | 'estimator' | 'complete'>('customer');
  const [customerSig, setCustomerSig] = useState<string | null>(null);
  const [estimatorSig, setEstimatorSig] = useState<string | null>(null);

  const customerCanvasRef = useRef<SignatureCanvas | null>(null);
  const estimatorCanvasRef = useRef<SignatureCanvas | null>(null);

  const handleCustomerDone = () => {
    const canvas = customerCanvasRef.current;
    if (!canvas || !customerName.trim() || canvas.isEmpty()) return;
    const sig = canvas.toDataURL('image/png');
    setCustomerSig(sig);
    uploadMedia.mutate({
      projectId: pid,
      fileName: `${project?.estimateNumber || 'estimate'}-customer-signature.png`,
      contentType: 'image/png',
      dataUrl: sig,
      category: 'customer-signature',
      caption: customerName,
      includeOnPdf: false,
      isInternal: true,
    });
    setStep('estimator');
  };

  const handleEstimatorDone = () => {
    const canvas = estimatorCanvasRef.current;
    if (!canvas || !estimatorName.trim() || canvas.isEmpty()) return;
    const sig = canvas.toDataURL('image/png');
    setEstimatorSig(sig);
    uploadMedia.mutate({
      projectId: pid,
      fileName: `${project?.estimateNumber || 'estimate'}-estimator-signature.png`,
      contentType: 'image/png',
      dataUrl: sig,
      category: 'estimator-signature',
      caption: estimatorName,
      includeOnPdf: false,
      isInternal: true,
    });

    updateProject.mutate({
      id: pid,
      status: 'signed',
      customerSignedAt: new Date(),
      customerSignatureName: customerName,
      estimatorSignedAt: new Date(),
      estimatorSignatureName: estimatorName,
    });

    setStep('complete');
  };

  const downloadSignaturePacket = () => {
    if (!project) return;
    const payload = {
      estimateNumber: project.estimateNumber,
      customerName,
      estimatorName,
      customerSignature: customerSig,
      estimatorSignature: estimatorSig,
      signedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.estimateNumber.toLowerCase()}-signatures.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!project) {
    return <div className="h-screen flex items-center justify-center bg-black text-[#555]">Loading...</div>;
  }

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => step === 'complete' ? navigate(`/project/${pid}`) : navigate(`/project/${pid}/pdf`)} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            {step === 'complete' ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <h1 className="text-sm font-semibold">
              {step === 'customer' && 'Customer Signature'}
              {step === 'estimator' && 'Estimator Signature'}
              {step === 'complete' && 'Estimate Signed'}
            </h1>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-32">
        {/* Estimate Summary */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#888] uppercase tracking-wider">Estimate</p>
              <p className="text-sm font-medium font-mono">{project.estimateNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#888]">Total</p>
              <p className="text-lg font-bold text-amber-400">{formatCurrency(project.total || 0)}</p>
            </div>
          </div>
          <p className="text-xs text-[#888] mt-1">{project.customerName} &middot; {project.propertyAddress}</p>
        </div>

        {/* Customer Signature Step */}
        {step === 'customer' && (
          <div>
            <div className="mb-4">
              <label className="text-xs text-[#888] mb-1.5 block">Customer Full Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Type full name as it will appear on the document"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
              />
            </div>

            <div className="mb-4">
              <label className="text-xs text-[#888] mb-1.5 block">Signature</label>
              <div className="rounded-xl border border-white/[0.12] overflow-hidden bg-white">
                <SignatureCanvas
                  ref={customerCanvasRef}
                  canvasProps={{ width: 600, height: 200, className: 'w-full h-[200px] touch-none cursor-crosshair' }}
                  penColor="black"
                  backgroundColor="white"
                />
              </div>
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => customerCanvasRef.current?.clear()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#888] hover:bg-white/5 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear
                </button>
              </div>
            </div>

            <p className="text-xs text-[#555] text-center mb-4">
              By signing, I agree to the scope of work, pricing, and terms outlined in this estimate.
            </p>
          </div>
        )}

        {/* Estimator Signature Step */}
        {step === 'estimator' && (
          <div>
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Check className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-amber-400">Customer signature captured for {customerName}</p>
            </div>

            <div className="mb-4">
              <label className="text-xs text-[#888] mb-1.5 block">Estimator Name</label>
              <input
                type="text"
                value={estimatorName}
                onChange={(e) => setEstimatorName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
              />
            </div>

            <div className="mb-4">
              <label className="text-xs text-[#888] mb-1.5 block">Estimator Signature</label>
              <div className="rounded-xl border border-white/[0.12] overflow-hidden bg-white">
                <SignatureCanvas
                  ref={estimatorCanvasRef}
                  canvasProps={{ width: 600, height: 200, className: 'w-full h-[200px] touch-none cursor-crosshair' }}
                  penColor="black"
                  backgroundColor="white"
                />
              </div>
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => estimatorCanvasRef.current?.clear()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#888] hover:bg-white/5 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Estimate Signed</h2>
            <p className="text-sm text-[#888] mb-1">Both parties have signed the estimate.</p>
            <p className="text-xs text-[#555] mb-6">
              {new Date().toLocaleDateString()} &middot; {project.estimateNumber}
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-left">
                  <p className="text-sm">Customer: {customerName}</p>
                  <p className="text-[10px] text-[#888]">Signed</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-left">
                  <p className="text-sm">Estimator: {estimatorName}</p>
                  <p className="text-[10px] text-[#888]">Signed</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm font-medium text-amber-400 mb-1">Next Steps</p>
              <p className="text-xs text-[#888]">
                The signed estimate is ready. You can now share it with the customer and 
                push it to your CRM pipeline.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={downloadSignaturePacket}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 py-3 text-sm text-[#cfcfcf] hover:bg-white/5 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Signatures
              </button>
              <button
                onClick={() => syncProject.mutate({ projectId: pid })}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-sm font-medium text-white"
              >
                <Send className="w-4 h-4" />
                Sync to GHL
              </button>
            </div>

            {syncProject.data?.warnings?.length ? (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-left">
                {syncProject.data.warnings.map((warning) => (
                  <p key={warning} className="text-[11px] text-amber-200">{warning}</p>
                ))}
              </div>
            ) : null}
            {syncProject.error ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-left">
                <p className="text-[11px] text-red-200">{syncProject.error.message}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      {step !== 'complete' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
            {step === 'customer' && (
              <>
                <button
                  onClick={() => navigate(`/project/${pid}/pdf`)}
                  className="flex-1 py-3 rounded-xl border border-white/[0.1] text-sm font-medium text-[#888] hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCustomerDone}
                  disabled={!customerName.trim()}
                  className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continue
                </button>
              </>
            )}
            {step === 'estimator' && (
              <>
                <button
                  onClick={() => setStep('customer')}
                  className="flex-1 py-3 rounded-xl border border-white/[0.1] text-sm font-medium text-[#888] hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleEstimatorDone}
                  disabled={!estimatorName.trim()}
                  className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Finalize Signature
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
            <button
              onClick={() => navigate(`/project/${pid}`)}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Open Estimate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
