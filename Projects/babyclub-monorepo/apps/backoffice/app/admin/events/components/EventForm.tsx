// apps/backoffice/app/admin/events/components/EventForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ManifestUploader from "./ManifestUploader";
import DatePickerSimple from "@/components/ui/DatePickerSimple";

type EventFormProps = {
  mode: "create" | "edit";
  initialData?: Partial<EventRecord> | null;
};

type EventRecord = {
  id?: string;
  name: string;
  location: string;
  starts_at: string;
  capacity: number;
  header_image: string;
  cover_image?: string;
  is_active: boolean;
  code?: string;
};

type FormValues = {
  name: string;
  location: string;
  starts_at: string;
  capacity: string;
  header_image: string;
  cover_image: string;
  is_active: boolean;
  code: string;
};

const emptyForm: FormValues = {
  name: "",
  location: "",
  starts_at: "",
  capacity: "",
  header_image: "",
  cover_image: "",
  is_active: true,
  code: "",
};

export default function EventForm({ mode, initialData }: EventFormProps) {
  const router = useRouter();

  const [form, setForm] = useState<FormValues>(() => ({
    ...emptyForm,
    ...normalizeInitial(initialData),
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const dateTimeParts = useMemo(() => toDateTimeParts12(form.starts_at), [form.starts_at]);
  const codeSuggestion = useMemo(() => slugify(form.name), [form.name]);

  useEffect(() => {
    setForm({ ...emptyForm, ...normalizeInitial(initialData) });
  }, [initialData]);

  useEffect(() => {
    if (initialData?.code) setCodeTouched(true);
  }, [initialData?.code]);

  useEffect(() => {
    setErrors(validate(form));
  }, [form]);

  const isValid = useMemo(() => Object.keys(validate(form)).length === 0, [form]);
  const showReadyBadge = isValid && !isSubmitting;

  const header = mode === "edit" ? "Actualizar evento" : "Nuevo evento";

  const updateField = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      setServerError("Revisa los campos marcados.");
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    const payload = {
      id: initialData?.id,
      name: form.name.trim(),
      location: form.location.trim(),
      starts_at: form.starts_at,
      capacity: Number(form.capacity || 0),
      header_image: form.header_image.trim(),
      cover_image: form.cover_image.trim(),
      is_active: Boolean(form.is_active),
      code: form.code.trim(),
    };

    try {
      const endpoint = mode === "edit" ? "/api/events/update" : "/api/events/create";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo guardar el evento");
      }

      router.push("/admin/events");
    } catch (err: any) {
      setServerError(err?.message || "Error desconocido");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">
            {mode === "edit" ? "Edición" : "Crear"}
          </p>
          <h2 className="text-2xl font-semibold text-white">{header}</h2>
        </div>
        {showReadyBadge && (
          <span className="rounded-full bg-[#111111] px-3 py-1 text-[12px] font-semibold text-[#e91e63]">
            Cambios listos
          </span>
        )}
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Nombre"
            placeholder="BABY Deluxe"
            value={form.name}
            onChange={(val) => updateField("name", val)}
            error={errors.name}
            required
          />
          <Field
            label="Ubicación"
            placeholder="Av. Siempre Viva 123"
            value={form.location}
            onChange={(val) => updateField("location", val)}
          />
          <Field
            label="Código del evento"
            placeholder={codeSuggestion || "baby-deluxe-2025"}
            value={form.code}
            onChange={(val) => {
              setCodeTouched(true);
              updateField("code", val);
            }}
            error={errors.code}
          />
          <Field
            label="Capacidad"
            type="number"
            min={10}
            placeholder="200"
            value={form.capacity}
            onChange={(val) => updateField("capacity", val)}
            error={errors.capacity}
          />
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-white" htmlFor="manifest-url">
              Manifiesto (imagen)
            </label>
            <input
              id="manifest-url"
              type="url"
              value={form.header_image}
              onChange={(e) => updateField("header_image", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
            />
            <ManifestUploader
              code={form.code || form.name}
              onUploaded={(url) => updateField("header_image", url)}
              initialUrl={form.header_image}
            />
            {form.header_image && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-2">
                <img src={form.header_image} alt="Manifiesto" className="h-40 w-full rounded-xl object-cover" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-white" htmlFor="cover-url">
              Cover (imagen cabecera)
            </label>
            <input
              id="cover-url"
              type="url"
              value={form.cover_image}
              onChange={(e) => updateField("cover_image", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
            />
            <ManifestUploader
              code={`${form.code || form.name}-cover`}
              onUploaded={(url) => updateField("cover_image", url)}
              initialUrl={form.cover_image}
              label="Subir cover (imagen)"
              inputId="cover-file"
            />
            {form.cover_image && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-2">
                <img src={form.cover_image} alt="Cover" className="h-40 w-full rounded-xl object-cover" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white" htmlFor="starts-at">
              Fecha y hora del evento
            </label>
            <div className="grid gap-3 md:grid-cols-[1.1fr,1fr]">
              <DatePickerSimple
                value={dateTimeParts.datePart}
                onChange={(next) => {
                  const nextIso = toIsoFromParts12(next, dateTimeParts.hour12, dateTimeParts.minute, dateTimeParts.period);
                  updateField("starts_at", nextIso);
                }}
                label={undefined}
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <select
                    aria-label="Hora"
                    value={dateTimeParts.hour12}
                    onChange={(e) => {
                      const nextIso = toIsoFromParts12(
                        dateTimeParts.datePart,
                        e.target.value,
                        dateTimeParts.minute,
                        dateTimeParts.period
                      );
                      updateField("starts_at", nextIso);
                    }}
                    className="w-full min-w-[68px] rounded-2xl border border-white/10 bg-[#0c0c0c] px-3 py-3 text-sm text-white outline-none transition focus:border-white"
                  >
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const h = ((idx + 1) % 13) || 1;
                      return (
                        <option key={h} value={String(h).padStart(2, "0")}>
                          {String(h).padStart(2, "0")}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    aria-label="Minutos"
                    value={dateTimeParts.minute}
                    onChange={(e) => {
                      const nextIso = toIsoFromParts12(
                        dateTimeParts.datePart,
                        dateTimeParts.hour12,
                        e.target.value,
                        dateTimeParts.period
                      );
                      updateField("starts_at", nextIso);
                    }}
                    className="w-full min-w-[68px] rounded-2xl border border-white/10 bg-[#0c0c0c] px-3 py-3 text-sm text-white outline-none transition focus:border-white"
                  >
                    {["00", "15", "30", "45"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Periodo"
                    value={dateTimeParts.period}
                    onChange={(e) => {
                      const nextIso = toIsoFromParts12(
                        dateTimeParts.datePart,
                        dateTimeParts.hour12,
                        dateTimeParts.minute,
                        e.target.value as "AM" | "PM"
                      );
                      updateField("starts_at", nextIso);
                    }}
                    className="w-full min-w-[68px] rounded-2xl border border-white/10 bg-[#0c0c0c] px-3 py-3 text-sm text-white outline-none transition focus:border-white"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const iso = now.toISOString();
                    updateField("starts_at", iso);
                  }}
                  className="rounded-2xl border border-white/10 bg-[#111] px-3 text-xs font-semibold text-white transition hover:border-white/30"
                >
                  Ahora
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const base = dateTimeParts.datePart
                      ? new Date(`${dateTimeParts.datePart}T${to24h(dateTimeParts.hour12, dateTimeParts.minute, dateTimeParts.period)}`)
                      : new Date();
                    base.setMinutes(base.getMinutes() + 30);
                    updateField("starts_at", base.toISOString());
                  }}
                  className="rounded-2xl border border-white/10 bg-[#111] px-3 text-xs font-semibold text-white transition hover:border-white/30"
                >
                  +30m
                </button>
              </div>
            </div>
            <p className="text-xs text-white/60">Se guarda en tu zona horaria local.</p>
            {errors.starts_at && <ErrorText message={errors.starts_at} />}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Checkbox
            label="Evento activo"
            checked={form.is_active}
            onChange={(checked) => updateField("is_active", checked)}
          />
        </div>

        {serverError && (
          <div className="rounded-2xl border border-[#2d0b0b] bg-[#1a0a0a] px-4 py-3 text-sm text-[#ff9a9a]">
            {serverError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-6 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)] disabled:opacity-70"
          >
            {isSubmitting ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear evento"}
          </button>
          <p className="text-xs text-[#f2f2f2]/60">Se guardará directamente en Supabase.</p>
        </div>
      </form>
    </section>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: number;
  step?: string;
  error?: string;
};

function Field({ label, value, onChange, placeholder, type = "text", required, min, step, error }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-white" htmlFor={label}>
        {label}
      </label>
      <input
        id={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white"
      />
      {error && <ErrorText message={error} />}
    </div>
  );
}

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-white/90">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border border-white/20 bg-[#0c0c0c] accent-[#e91e63]"
      />
      <span>{label}</span>
    </label>
  );
}

function ErrorText({ message }: { message: string }) {
  return <p className="text-xs font-semibold text-[#ff9a9a]">{message}</p>;
}

function toDateTimeParts12(iso: string): { datePart: string; hour12: string; minute: string; period: "AM" | "PM" } {
  if (!iso) return { datePart: "", hour12: "12", minute: "00", period: "AM" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { datePart: "", hour12: "12", minute: "00", period: "AM" };
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hours24 = d.getHours();
  const period: "AM" | "PM" = hours24 >= 12 ? "PM" : "AM";
  const hour12 = pad(((hours24 + 11) % 12) + 1);
  const minute = pad(d.getMinutes());
  return { datePart, hour12, minute, period };
}

function to24h(hour12: string, minute: string, period: "AM" | "PM") {
  const h12 = Number(hour12) || 12;
  const minutes = minute || "00";
  const h24 = period === "PM" ? ((h12 % 12) + 12) % 24 : h12 % 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h24)}:${pad(Number(minutes) || 0)}`;
}

function toIsoFromParts12(datePart: string, hour12: string, minute: string, period: "AM" | "PM") {
  if (!datePart) return "";
  const time24 = to24h(hour12, minute, period);
  const local = new Date(`${datePart}T${time24}`);
  if (Number.isNaN(local.getTime())) return "";
  return local.toISOString();
}

function normalizeInitial(initialData?: Partial<EventRecord> | null): Partial<FormValues> {
  if (!initialData) return {};
  return {
    name: initialData.name ?? "",
    location: initialData.location ?? "",
    starts_at: initialData.starts_at ? new Date(initialData.starts_at).toISOString() : "",
    capacity: initialData.capacity != null ? String(initialData.capacity) : "",
    header_image: initialData.header_image ?? "",
    cover_image: initialData.cover_image ?? "",
    is_active: initialData.is_active ?? true,
    code: initialData.code ?? "",
  };
}

function validate(values: FormValues): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {};

  if (!values.name.trim()) errors.name = "Nombre requerido";
  if (!values.starts_at) errors.starts_at = "Selecciona fecha y hora";

  const capacity = Number(values.capacity);
  if (!Number.isFinite(capacity) || capacity < 10) errors.capacity = "Capacidad mínima 10";

  if (!values.code.trim()) errors.code = "Código requerido";
  else if (values.code.length < 3) errors.code = "Código mínimo 3 caracteres";

  return errors;
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
