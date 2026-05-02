import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { trpc } from '@/providers/trpc';
import { statusLabels, appConfig } from '@/config';
import { ArrowLeft, FileText, Edit3, Copy, Printer, Share2, Trash2, ChevronRight, Send, Sparkles, Boxes, Palette } from 'lucide-react';
import { formatCurrency } from '@/utils/estimate';

export default function EstimateDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const pid = Number(projectId);

  const { data: project, isLoading } = trpc.projects.get.useQuery({ id: pid });
  const { data: rooms = [] } = trpc.rooms.list.useQuery({ projectId: pid });
  const { data: lineItems = [] } = trpc.lineItems.list.useQuery({ projectId: pid });

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      navigate('/');
    },
  });
  const duplicateProject = trpc.projects.duplicate.useMutation({
    onSuccess: (data) => {
      utils.projects.list.invalidate();
      if (data.id) navigate(`/project/${data.id}`);
    },
  });
  const syncProject = trpc.sync.projectToGhl.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate({ id: pid });
      utils.projects.list.invalidate();
    },
  });

  const [showActions, setShowActions] = useState(false);

  if (isLoading || !project) {
    return <div className="h-screen flex items-center justify-center bg-black text-[#555]">Loading...</div>;
  }

  const status = statusLabels[project.status] || statusLabels.draft;
  const total = Number(project.total || 0);
  const subtotal = Number(project.subtotal || 0);
  const customerItems = lineItems.filter((i) => !i.isInternal);

  const actionButtons = [
    { icon: Edit3, label: 'Edit', action: () => navigate(`/project/${pid}/setup`), color: '#c8956c' },
    { icon: Palette, label: 'Rooms', action: () => navigate(`/project/${pid}/rooms`), color: '#c8956c' },
    { icon: Boxes, label: 'Estimate', action: () => navigate(`/project/${pid}/estimate`), color: '#c8956c' },
    { icon: FileText, label: 'PDF', action: () => navigate(`/project/${pid}/pdf`), color: '#5a9fd4' },
    { icon: Printer, label: 'Print', action: () => window.print(), color: '#888' },
    { icon: Copy, label: 'Duplicate', action: () => duplicateProject.mutate({ id: pid }), color: '#888' },
    { icon: Send, label: 'Sync GHL', action: () => syncProject.mutate({ projectId: pid }), color: '#7dac5a' },
    { icon: Trash2, label: 'Delete', action: () => { if (confirm('Delete this estimate?')) deleteProject.mutate({ id: pid }); }, color: '#c45a5a' },
  ];

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <h1 className="text-sm font-semibold">Estimate Detail</h1>
          </div>
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Actions Menu */}
      {showActions && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
          <div className="absolute right-4 top-14 z-50 w-48 rounded-xl bg-[#111] border border-white/[0.06] py-1 shadow-2xl">
            {actionButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={() => { btn.action(); setShowActions(false); }}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#e0e0e0] hover:bg-white/5 transition-colors"
              >
                <btn.icon className="w-3.5 h-3.5" style={{ color: btn.color }} />
                {btn.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="max-w-3xl mx-auto px-4 py-4 pb-24">
        {/* Status Card */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 p-5 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider mb-2"
                style={{ color: status.color, backgroundColor: status.bgColor }}
              >
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: status.color }} />
                {status.label}
              </span>
              <h2 className="text-lg font-semibold">{project.customerName}</h2>
              <p className="text-xs text-[#888] font-mono mt-0.5">{project.estimateNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(total)}</p>
              <p className="text-[10px] text-[#888]">{customerItems.length} line items</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-[#888]">
            <span>{project.propertyType}</span>
            <span>&middot;</span>
            <span>{project.projectType}</span>
            <span>&middot;</span>
            <span>{rooms.length} rooms</span>
          </div>

          <p className="text-xs text-[#888] mt-2">{project.propertyAddress}</p>

          {project.status === 'signed' && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400">
                Signed by {project.customerSignatureName} on {project.customerSignedAt ? new Date(project.customerSignedAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#666]">CRM Sync</p>
              <p className="text-sm font-medium">{project.crmSyncStatus || 'not_needed'}</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#666]">Deposit Target</p>
              <p className="text-sm font-medium">{formatCurrency(project.depositAmount || 0)}</p>
            </div>
          </div>

          {syncProject.data?.warnings?.length ? (
            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              {syncProject.data.warnings.map((warning) => (
                <p key={warning} className="text-[11px] text-amber-200">{warning}</p>
              ))}
            </div>
          ) : null}
          {syncProject.error ? (
            <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-[11px] text-red-200">{syncProject.error.message}</p>
            </div>
          ) : null}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {[
            { icon: Edit3, label: 'Edit', color: '#c8956c', action: () => navigate(`/project/${pid}/setup`) },
            { icon: Palette, label: 'Rooms', color: '#c8956c', action: () => navigate(`/project/${pid}/rooms`) },
            { icon: Boxes, label: 'Estimate', color: '#c8956c', action: () => navigate(`/project/${pid}/estimate`) },
            { icon: FileText, label: 'PDF', color: '#5a9fd4', action: () => navigate(`/project/${pid}/pdf`) },
            { icon: Send, label: 'Sync', color: '#7dac5a', action: () => syncProject.mutate({ projectId: pid }) },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <btn.icon className="w-5 h-5" style={{ color: btn.color }} />
              <span className="text-[10px] text-[#888]">{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Rooms Summary */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-3">Rooms</h3>
          <div className="space-y-1.5">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/project/${pid}/room/${room.id}`)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{room.name}</p>
                  <p className="text-[10px] text-[#888]">
                    {room.totalSqFt ? `${Number(room.totalSqFt).toLocaleString()} sq ft` : 'No dimensions'}
                    {room.paintScope && room.paintScope.length > 0 && ` · ${room.paintScope.join(', ')}`}
                    {room.paintColor && ` · ${room.paintColor}`}
                  </p>
                </div>
                {room.subtotal && Number(room.subtotal) > 0 && (
                  <span className="text-xs text-amber-400">{formatCurrency(room.subtotal)}</span>
                )}
                <ChevronRight className="w-4 h-4 text-[#555]" />
              </button>
            ))}
          </div>
        </div>

        {/* Line Items */}
        {customerItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-3">Line Items</h3>
            <div className="space-y-1">
              {customerItems.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div>
                    <p className="text-sm">{item.description}</p>
                    <p className="text-[10px] text-[#888]">{Number(item.quantity).toLocaleString()} {item.unit} @ {formatCurrency(item.rate)}</p>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
              {customerItems.length > 8 && (
                <button
                  onClick={() => navigate(`/project/${pid}/estimate`)}
                  className="w-full text-center py-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  View all {customerItems.length} items
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pricing Summary */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
          <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider mb-3">Pricing</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#888]">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {Number(project.taxAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-[#888]">Tax ({project.taxRate}%)</span>
                <span>{formatCurrency(project.taxAmount)}</span>
              </div>
            )}
            {Number(project.discountAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-[#888]">Discount</span>
                <span className="text-red-400">-{formatCurrency(project.discountAmount).replace('$', '')}</span>
              </div>
            )}
            <div className="border-t border-white/[0.06] pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-amber-400">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-xs text-[#888]">
              <span>Deposit ({project.depositPercent || appConfig.defaultDepositPercent}%)</span>
              <span>{formatCurrency(project.depositAmount || 0)}</span>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="mt-6 text-center text-[10px] text-[#555]">
          <p>Created: {new Date(project.createdAt).toLocaleString()}</p>
          <p>Last updated: {new Date(project.updatedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
