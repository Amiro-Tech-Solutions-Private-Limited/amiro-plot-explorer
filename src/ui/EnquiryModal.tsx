import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FLAT_BY_ID, PROJECT, unitOf } from '../data/project';
import { useStore } from '../store/useStore';
import { todayIST } from '../lib/sun';
import { Icon } from './Icon';

interface Form {
  name: string;
  phone: string;
  email: string;
  date: string;
  message: string;
  consent: boolean;
}

const EMPTY: Form = { name: '', phone: '', email: '', date: '', message: '', consent: false };

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  const name = f.name.trim();
  if (name.length < 2 || name.length > 60 || !/^[\p{L} .'-]+$/u.test(name)) e.name = 'Please enter your full name';
  const phone = f.phone.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');
  if (!/^[6-9]\d{9}$/.test(phone)) e.phone = 'Enter a valid 10-digit Indian mobile number';
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) e.email = 'Enter a valid email';
  if (f.date && f.date < todayIST()) e.date = 'Pick today or a future date';
  if (f.message.length > 500) e.message = 'Keep it under 500 characters';
  if (!f.consent) e.consent = 'Please accept to be contacted';
  return e;
}

export function EnquiryModal() {
  const flatId = useStore((s) => s.enquiryFor);
  const set = useStore((s) => s.set);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [done, setDone] = useState<string | null>(null);
  const flat = flatId ? FLAT_BY_ID.get(flatId) : undefined;

  const close = () => {
    set({ enquiryFor: null });
    setTimeout(() => {
      setForm(EMPTY);
      setErrors({});
      setDone(null);
    }, 300);
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    // No backend in v1: generate a local reference only.
    setDone(`SR-${flatId}-${Date.now().toString(36).toUpperCase().slice(-5)}`);
  };

  const field = (k: keyof Form) => ({
    value: form[k] as string,
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
    'aria-invalid': !!errors[k],
    className: `w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${errors[k] ? 'border-red-400' : 'border-slate-200'}`,
  });

  return (
    <AnimatePresence>
      {flat && (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-3 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Enquiry form"
            initial={{ y: 30, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 30, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{done ? 'Request received' : 'Enquire / book a site visit'}</h2>
                <p className="text-xs text-slate-500">
                  {PROJECT.name} · Flat {flat.id} · {unitOf(flat).label}
                </p>
              </div>
              <button onClick={close} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-900/5">
                <Icon name="close" />
              </button>
            </div>

            {done ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Icon name="check" size={28} />
                </div>
                <p className="text-sm text-slate-700">
                  Thank you, {form.name.trim().split(' ')[0]}! Our sales team will call you shortly{form.date ? ` to confirm your visit on ${form.date}` : ''}.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Reference <b className="text-slate-800">{done}</b>
                </p>
                <button onClick={close} className="mt-4 rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="enq-name">Full name *</label>
                  <input id="enq-name" autoComplete="name" maxLength={60} {...field('name')} />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="enq-phone">Mobile number *</label>
                  <input id="enq-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={16} placeholder="98xxxxxxxx" {...field('phone')} />
                  {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="enq-email">Email</label>
                    <input id="enq-email" type="email" autoComplete="email" maxLength={80} {...field('email')} />
                    {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="enq-date">Site visit date</label>
                    <input id="enq-date" type="date" min={todayIST()} {...field('date')} />
                    {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="enq-msg">Message</label>
                  <textarea id="enq-msg" rows={3} maxLength={500} {...field('message')} />
                </div>
                <label className="flex items-start gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5 accent-brand-700" />
                  I agree to be contacted by {PROJECT.name} by phone, SMS or WhatsApp about this enquiry.
                </label>
                {errors.consent && <p className="-mt-2 text-xs text-red-600">{errors.consent}</p>}
                <button className="w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-600">Submit request</button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
