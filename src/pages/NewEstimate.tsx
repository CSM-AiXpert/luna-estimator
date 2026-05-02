import { useState } from 'react';
import { useNavigate } from 'react-router';
import { trpc } from '@/providers/trpc';
import { propertyTypes, projectTypes } from '@/config';
import { ArrowLeft } from 'lucide-react';

export default function NewEstimate() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: (data) => {
      utils.projects.list.invalidate();
      navigate(`/project/${data.id}/setup`);
    },
  });

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    propertyAddress: '',
    propertyType: '',
    projectType: '',
    notes: '',
    leadSource: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');

  const handleSubmit = () => {
    if (!form.customerName.trim() || !form.propertyAddress.trim()) return;
    createMutation.mutate({
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim() || undefined,
      customerEmail: form.customerEmail.trim() || undefined,
      propertyAddress: form.propertyAddress.trim(),
      propertyType: form.propertyType || undefined,
      projectType: form.projectType || undefined,
      notes: form.notes.trim() || undefined,
      leadSource: form.leadSource.trim() || undefined,
      tags: form.tags.length > 0 ? form.tags : undefined,
    });
  };

  const isValid = form.customerName.trim() && form.propertyAddress.trim();

  return (
    <div className="min-h-screen w-full bg-black text-[#e0e0e0]">
      {/* Header */}
      <header className="sticky top-0 z-30 liquid-glass">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-[#888]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold">New Estimate</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-24">
        {/* Customer Info */}
        <Section title="Customer Information">
          <Field label="Full Name *" required>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="John & Jane Smith"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                placeholder="(803) 555-0123"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                placeholder="customer@email.com"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
              />
            </Field>
          </div>
        </Section>

        {/* Property Info */}
        <Section title="Property Information">
          <Field label="Service Address *" required>
            <textarea
              value={form.propertyAddress}
              onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })}
              placeholder="123 Main Street, Columbia, SC 29201"
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555] resize-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Property Type">
              <select
                value={form.propertyType}
                onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors appearance-none text-[#e0e0e0]"
              >
                <option value="">Select type</option>
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Project Type">
              <select
                value={form.projectType}
                onChange={(e) => setForm({ ...form, projectType: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors appearance-none text-[#e0e0e0]"
              >
                <option value="">Select type</option>
                {projectTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes & Source">
          <Field label="Project Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any initial notes about the project..."
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555] resize-none"
            />
          </Field>
          <Field label="Lead Source">
            <input
              type="text"
              value={form.leadSource}
              onChange={(e) => setForm({ ...form, leadSource: e.target.value })}
              placeholder="Referral, Google, Facebook, etc."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
            />
          </Field>
          <Field label="Tags">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-xs">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    if (!form.tags.includes(tagInput.trim())) {
                      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
                    }
                    setTagInput('');
                  }
                }}
                placeholder="Add tag and press Enter"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500/40 transition-colors placeholder:text-[#555]"
              />
            </div>
          </Field>
        </Section>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 rounded-xl border border-white/[0.1] text-sm font-medium text-[#888] hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || createMutation.isPending}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Estimate'}
          </button>
        </div>
      </div>
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[#888] mb-1.5">
        {label}
        {required && <span className="text-[#c45a5a] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
