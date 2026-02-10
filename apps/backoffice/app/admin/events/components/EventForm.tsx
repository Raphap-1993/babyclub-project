// apps/backoffice/app/admin/events/components/EventForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ManifestUploader from "./ManifestUploader";
import ModernDatePicker from "@repo/ui/components/modern-date-picker";
import ModernTimePicker from "@repo/ui/components/modern-time-picker";
import { EVENT_ZONE, toLimaPartsFromDb, toUTCISOFromLimaParts } from "shared/limaTime";
import { DEFAULT_ENTRY_LIMIT, normalizeEntryLimit } from "shared/entryLimit";
import { DateTime } from "luxon";
import { supabaseClient } from "@/lib/supabaseClient";

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabaseClient) return {};
  const { data } = await supabaseClient.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type EventFormProps = {
  mode: "create" | "edit";
  initialData?: Partial<EventRecord> | null;
  organizers: { id: string; name: string; slug: string }[];
};

type EventRecord = {
  id?: string;
  name: string;
  location: string;
  starts_at: string;
  entry_limit?: string | null;
  capacity: number;
  header_image: string;
  cover_image?: string;
  is_active: boolean;
  code?: string;
  organizer_id?: string;
};

type FormValues = {
  name: string;
  location: string;
  starts_at: string;
  entry_limit: string;
  capacity: string;
  header_image: string;
  cover_image: string;
  is_active: boolean;
  code: string;
  organizer_id: string;
};

const emptyForm: FormValues = {
  name: "",
  location: "",
  starts_at: "",
  entry_limit: DEFAULT_ENTRY_LIMIT,
  capacity: "",
  header_image: "",
  cover_image: "",
  is_active: true,
  code: "",
  organizer_id: "",
};

export default function EventForm({ mode, initialData, organizers }: EventFormProps) {
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

  // Código debe ser ingresado manualmente (no auto-fill)

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

    const entryLimit = normalizeEntryLimit(form.entry_limit) || DEFAULT_ENTRY_LIMIT;
    const payload = {
      id: initialData?.id,
      name: form.name.trim(),
      location: form.location.trim(),
      starts_at: form.starts_at,
      entry_limit: entryLimit,
      capacity: Number(form.capacity || 0),
      header_image: form.header_image.trim(),
      cover_image: form.cover_image.trim(),
      is_active: Boolean(form.is_active),
      code: form.code.trim(),
      organizer_id: form.organizer_id,
    };

    try {
      const endpoint = mode === "edit" ? "/api/events/update" : "/api/events/create";
      const authHeaders = await getAuthHeaders();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...authHeaders,
        },
        credentials: "include",
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
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400 mb-1">
              {mode === "edit" ? "EDICIÓN" : "CREAR"}
            </p>
            <h2 className="text-xl font-semibold text-white">{header}</h2>
          </div>
          {showReadyBadge && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-lg">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-sm font-medium text-green-300">Cambios listos</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* Campo Organizador */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Organizador <span className="text-red-400">*</span>
            </label>
            <select
              name="organizer_id"
              value={form.organizer_id}
              onChange={(e) => updateField("organizer_id", e.target.value)}
              className={`w-full px-4 py-2.5 bg-slate-800 border ${
                errors.organizer_id ? "border-red-500" : "border-slate-600"
              } rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              required
            >
              <option value="">-- Selecciona organizador --</option>
              {organizers.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            {errors.organizer_id && (
              <p className="text-xs text-red-400 mt-1">{errors.organizer_id}</p>
            )}
          </div>

          <Field
            label="Código del evento"
            placeholder={codeSuggestion || "baby-deluxe-0227"}
            value={form.code}
            onChange={(val) => {
              setCodeTouched(true);
              updateField("code", val);
            }}
            error={errors.code}
          />
          {!codeTouched && codeSuggestion && (
            <p className="text-xs text-blue-400 -mt-1">
              💡 Sugerencia: {codeSuggestion}
            </p>
          )}
          <Field
            label="Capacidad"
            type="number"
            min={10}
            placeholder="200"
            value={form.capacity}
            onChange={(val) => updateField("capacity", val)}
            error={errors.capacity}
          />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Fecha y hora del evento (America/Lima)
              </label>
              <div className="flex gap-2">
                <div className="w-[40%]">
                  <ModernDatePicker
                    value={dateTimeParts.datePart || ""}
                    onChange={(dateStr) => {
                      const nextIso = toIsoFromParts12(dateStr, dateTimeParts.hour12, dateTimeParts.minute, dateTimeParts.period);
                      updateField("starts_at", nextIso);
                    }}
                    placeholder="Seleccionar fecha"
                  />
                </div>
                <div className="flex-1 flex gap-2">
                  <ModernTimePicker
                    value={dateTimeParts.hour12 && dateTimeParts.minute ? (() => {
                      const h24 = to24h(Number(dateTimeParts.hour12), dateTimeParts.period);
                      return `${h24.toString().padStart(2, '0')}:${dateTimeParts.minute}`;
                    })() : ""}
                    onChange={(timeStr) => {
                      const [hour24, minute] = timeStr.split(':');
                      const h24 = Number(hour24);
                      const period = h24 >= 12 ? 'PM' : 'AM';
                      const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                      const nextIso = toIsoFromParts12(
                        dateTimeParts.datePart,
                        String(hour12).padStart(2, '0'),
                        minute,
                        period
                      );
                      updateField("starts_at", nextIso);
                    }}
                    placeholder="Hora"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nowIso = DateTime.now().setZone(EVENT_ZONE).toUTC().toISO();
                      if (nowIso) updateField("starts_at", nowIso);
                    }}
                    className="px-2 py-2 bg-slate-600 hover:bg-slate-500 border border-slate-500 rounded-lg text-xs font-medium text-white transition-colors whitespace-nowrap"
                  >
                    Ahora
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400">Se guarda en UTC en la BD.</p>
              {errors.starts_at && <ErrorText message={errors.starts_at} />}
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Hora límite de ingreso (America/Lima)
              </label>
              <ModernTimePicker
                value={form.entry_limit}
                onChange={(timeStr) => updateField("entry_limit", timeStr)}
                placeholder="Hora límite"
              />
              <p className="text-xs text-slate-400">
                Si es menor a la hora del evento, se asume día siguiente.
              </p>
              {errors.entry_limit && <ErrorText message={errors.entry_limit} />}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Manifiesto (imagen)
              </label>
              <ManifestUploader
                code={form.code || form.name}
                onUploaded={(url) => updateField("header_image", url)}
                initialUrl={form.header_image}
              />
              {form.header_image && (
                <div className="overflow-hidden rounded-lg border border-slate-600 bg-slate-700 p-2">
                  <img src={form.header_image} alt="Manifiesto" className="h-32 w-full rounded-md object-cover" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Cover (imagen cabecera)
              </label>
              <ManifestUploader
                code={`${form.code || form.name}-cover`}
                onUploaded={(url) => updateField("cover_image", url)}
                initialUrl={form.cover_image}
                label="Subir cover (imagen)"
                inputId="cover-file"
              />
              {form.cover_image && (
                <div className="overflow-hidden rounded-lg border border-slate-600 bg-slate-700 p-2">
                  <img src={form.cover_image} alt="Cover" className="h-32 w-full rounded-md object-cover" />
                </div>
              )}
            </div>
          </div>

<div className="flex items-center gap-4">
          <Checkbox
            label="Evento activo"
            checked={form.is_active}
            onChange={(checked) => updateField("is_active", checked)}
          />
        </div>

        {serverError && (
          <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-sm text-red-300">{serverError}</p>
          </div>
        )}

        <div className="flex items-center gap-4 pt-4 border-t border-slate-700">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-400 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear evento"}
          </button>
          <p className="text-sm text-slate-400">Se guardará directamente en Supabase.</p>
        </div>
      </form>
    </div>
  </div>
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
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-300" htmlFor={label}>
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
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
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
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
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 bg-slate-700 border border-slate-600 rounded focus:ring-blue-500/50 focus:ring-2"
      />
      <span className="text-sm font-medium text-slate-300">{label}</span>
    </label>
  );
}

function ErrorText({ message }: { message: string }) {
  return <p className="text-sm text-red-400">{message}</p>;
}

function toDateTimeParts12(iso: string): { datePart: string; hour12: string; minute: string; period: "AM" | "PM" } {
  if (!iso) return { datePart: "", hour12: "12", minute: "00", period: "AM" };
  try {
    const parsed = toLimaPartsFromDb(iso);
    return {
      datePart: toInputDate(parsed.date),
      hour12: String(parsed.hour12).padStart(2, "0"),
      minute: String(parsed.minute).padStart(2, "0"),
      period: parsed.ampm,
    };
  } catch (_err) {
    return { datePart: "", hour12: "12", minute: "00", period: "AM" };
  }
}

function toIsoFromParts12(datePart: string, hour12: string, minute: string, period: "AM" | "PM") {
  if (!datePart) return "";
  const hour12Num = Number(hour12) || 12;
  const minuteNum = Number(minute) || 0;
  return toUTCISOFromLimaParts({
    date: toLimaDate(datePart),
    hour12: hour12Num,
    minute: minuteNum,
    ampm: period,
  });
}

function normalizeInitial(initialData?: Partial<EventRecord> | null): Partial<FormValues> {
  if (!initialData) return {};
  return {
    name: initialData.name ?? "",
    location: initialData.location ?? "",
    starts_at: initialData.starts_at ?? "",
    entry_limit: normalizeEntryLimit(initialData.entry_limit) || DEFAULT_ENTRY_LIMIT,
    capacity: initialData.capacity != null ? String(initialData.capacity) : "",
    header_image: initialData.header_image ?? "",
    cover_image: initialData.cover_image ?? "",
    is_active: initialData.is_active ?? true,
    code: initialData.code ?? "",
    organizer_id: initialData.organizer_id ?? "",
  };
}

function to24h(hour12: number, ampm: "AM" | "PM") {
  if (ampm === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function toLimaDate(inputDatePart: string) {
  // input datePart viene como yyyy-MM-dd desde el picker
  const [y, m, d] = inputDatePart.split("-").map((n) => Number(n));
  if (!y || !m || !d) throw new Error("Fecha inválida");
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${String(y).padStart(4, "0")}`;
}

function toInputDate(limaDate: string) {
  // convierte dd/LL/yyyy a yyyy-MM-dd
  const [d, m, y] = limaDate.split("/").map((n) => Number(n));
  if (!y || !m || !d) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function validate(values: FormValues): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {};

  if (!values.name.trim()) errors.name = "Nombre requerido";
  if (!values.starts_at) errors.starts_at = "Selecciona fecha y hora";
  if (!normalizeEntryLimit(values.entry_limit)) errors.entry_limit = "Hora límite inválida";

  const capacity = Number(values.capacity);
  if (!Number.isFinite(capacity) || capacity < 10) errors.capacity = "Capacidad mínima 10";

  // Código es obligatorio y debe tener mínimo 3 caracteres
  if (!values.code || values.code.length < 3) {
    errors.code = "Código requerido (mínimo 3 caracteres)";
  }

  // Organizador es obligatorio
  if (!values.organizer_id) {
    errors.organizer_id = "Debes seleccionar un organizador";
  }

  return errors;
}

function slugify(input: string) {
  if (!input) return "";
  const parts = input.split(/\s+/);
  const slug = parts
    .slice(0, 2) // Primeras 2 palabras
    .map(w => w.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  
  // Agregar fecha si tenemos starts_at
  return slug;
}

