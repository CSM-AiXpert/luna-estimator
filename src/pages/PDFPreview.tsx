import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { trpc } from '@/providers/trpc';
import { defaultEstimateTerms } from '@/config';
import { ArrowLeft, FileText, ChevronRight, Printer, Download } from 'lucide-react';
import { calculateProjectTotals, disclaimerSections, formatCurrency, toNumber } from '@/utils/estimate';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { blobToDataUrl } from '@/utils/ai';

export default function PDFPreview() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const pid = Number(projectId);
  const pdfRef = useRef<HTMLDivElement>(null);

  const { data: project } = trpc.projects.get.useQuery({ id: pid });
  const { data: rooms = [] } = trpc.rooms.list.useQuery({ projectId: pid });
  const { data: lineItems = [] } = trpc.lineItems.list.useQuery({ projectId: pid });
  const { data: projectMedia = [] } = trpc.media.list.useQuery({ projectId: pid });
  const utils = trpc.useUtils();
  const uploadMedia = trpc.media.upload.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate({ id: pid });
      utils.media.list.invalidate({ projectId: pid });
    },
  });

  const taxRate = Number(project?.taxRate || 0);
  const discount = Number(project?.discountAmount || 0);
  const { customerItems, subtotal, taxAmount, total } = calculateProjectTotals(lineItems, taxRate, discount);

  const groupedByRoom = new Map<number | null, typeof lineItems>();
  customerItems.forEach((item) => {
    const key = item.roomId;
    if (!groupedByRoom.has(key)) groupedByRoom.set(key, []);
    groupedByRoom.get(key)!.push(item);
  });

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = async () => {
    if (!pdfRef.current || !project) return;

    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
    const imageData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'pt', 'letter');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imageData, 'PNG', 0, 0, pageWidth, pageHeight);
    const blob = pdf.output('blob');
    const dataUrl = await blobToDataUrl(blob);
    const category = project.status === 'signed' ? 'signed-pdf' : 'unsigned-pdf';

    await uploadMedia.mutateAsync({
      projectId: pid,
      fileName: `${project.estimateNumber.toLowerCase()}-${category}.pdf`,
      contentType: 'application/pdf',
      dataUrl,
      category,
      caption: `${project.estimateNumber} ${project.status === 'signed' ? 'signed' : 'unsigned'} estimate`,
      includeOnPdf: false,
    });

    pdf.save(`${project.estimateNumber.toLowerCase()}.pdf`);
  };

  if (!project) {
    return <div className="h-screen flex items-center justify-center bg-black text-[#555]">Loading...</div>;
  }

  const customerSignature = projectMedia.find((item) => item.category === 'customer-signature');
  const estimatorSignature = projectMedia.find((item) => item.category === 'estimator-signature');

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(`/project/${pid}/estimate`)} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <h1 className="text-sm font-semibold">PDF Preview</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void handleSavePdf()} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={handlePrint} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* PDF Content */}
      <div ref={pdfRef} className="max-w-3xl mx-auto px-4 py-6 pb-32">
        <div className="bg-white text-black rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">Luna Drywall & Paint</h1>
                <p className="text-sm opacity-90">Professional Painting & Drywall Services</p>
                <p className="text-xs opacity-70 mt-1">South Carolina</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-70 uppercase tracking-wider">Estimate</p>
                <p className="text-lg font-bold font-mono">{project.estimateNumber}</p>
              </div>
            </div>
          </div>

          {/* Customer & Project Info */}
          <div className="p-6 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Prepared For</p>
                <p className="font-semibold">{project.customerName}</p>
                {project.customerPhone && <p className="text-sm text-gray-600">{project.customerPhone}</p>}
                {project.customerEmail && <p className="text-sm text-gray-600">{project.customerEmail}</p>}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Property</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{project.propertyAddress}</p>
                <p className="text-sm text-gray-600 mt-1">{project.propertyType} &middot; {project.projectType}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
              <span>Date: {new Date(project.createdAt).toLocaleDateString()}</span>
              {project.leadSource && <span>Source: {project.leadSource}</span>}
            </div>
          </div>

          {/* Line Items */}
          <div className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Scope of Work</h2>

            {Array.from(groupedByRoom.entries()).map(([roomId, items]) => {
              const room = rooms.find((r) => r.id === roomId);
              return (
                <div key={roomId ?? 'general'} className="mb-4">
                  <h3 className="text-xs font-semibold bg-gray-50 px-3 py-2 rounded-lg mb-1">
                    {room ? room.name : 'General'}
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                        <th className="text-left py-2 pl-3">Description</th>
                        <th className="text-right py-2">Qty</th>
                        <th className="text-right py-2">Rate</th>
                        <th className="text-right py-2 pr-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-2 pl-3">
                            <span className="font-medium">{item.description}</span>
                            {item.scope && <span className="text-gray-400 ml-2">({item.scope})</span>}
                          </td>
                          <td className="text-right py-2">{toNumber(item.quantity).toLocaleString()} {item.unit}</td>
                          <td className="text-right py-2">{formatCurrency(item.rate)}</td>
                          <td className="text-right py-2 pr-3 font-medium">{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Totals */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Tax ({taxRate}%)</span>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-red-500">-{formatCurrency(discount).replace('$', '')}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold mt-3 pt-3 border-t border-gray-200">
                <span>Total</span>
                <span className="text-amber-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="px-6 pb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Terms & Conditions</h2>
            <div className="text-xs text-gray-600 whitespace-pre-line leading-relaxed bg-gray-50 p-4 rounded-xl">
              {defaultEstimateTerms}
            </div>
          </div>

          {/* Disclaimers */}
          <div className="px-6 pb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Notices</h2>
            <div className="text-[10px] text-gray-500 space-y-2 leading-relaxed">
              {disclaimerSections.map((section) => (
                <p key={section.title}>
                  <strong>{section.title}:</strong> {section.body}
                </p>
              ))}
            </div>
          </div>

          {/* Acceptance */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Acceptance</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-400 mb-8">Customer Signature</p>
                <div className="border-t border-gray-300 pt-2">
                  {customerSignature?.url && (
                    <img src={customerSignature.url} alt="Customer signature" className="mb-3 h-16 object-contain" />
                  )}
                  <p className="text-xs font-medium">{project.customerName}</p>
                  <p className="text-[10px] text-gray-400">Date: _______________</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-8">Estimator Signature</p>
                <div className="border-t border-gray-300 pt-2">
                  {estimatorSignature?.url && (
                    <img src={estimatorSignature.url} alt="Estimator signature" className="mb-3 h-16 object-contain" />
                  )}
                  <p className="text-xs font-medium">Luna Drywall & Paint</p>
                  <p className="text-[10px] text-gray-400">Date: _______________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
          <button
            onClick={() => navigate(`/project/${pid}/estimate`)}
            className="flex-1 py-3 rounded-xl border border-white/[0.1] text-sm font-medium text-[#888] hover:bg-white/5 transition-colors"
          >
            Edit Estimate
          </button>
          <button
            onClick={() => void handleSavePdf()}
            className="flex-1 py-3 rounded-xl border border-white/[0.1] text-sm font-medium text-[#cfcfcf] hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Save PDF
          </button>
          <button
            onClick={() => navigate(`/project/${pid}/signature`)}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Get Signatures
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
