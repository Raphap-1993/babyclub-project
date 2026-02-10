// apps/backoffice/app/admin/events/components/EventForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ManifestUploader from "./ManifestUploader";
import DatePickerSimple from "@/components/ui/DatePickerSimple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { authedFetch } from "@/lib/authedFetch";
import { EVENT_ZONE, toLimaPartsFromDb, toUTCISOFromLimaParts } from "shared/limaTime";
import { DEFAULT_ENTRY_LIMIT, normalizeEntryLimit } from "shared/entryLimit";
import { DateTime } from "luxon";

type EventFormProps = {
  mode: "create" | "edit";
  initialData?: Partial<EventRecord> | null;
};

type EventRecord = {
  id?: string;
  name: string;
  location: string;
  organizer_id?: string | null;
  starts_at: string;
  entry_limit?: string | null;
  capacity: number;
  header_image: string;
  cover_image?: string;
  is_active: boolean;
  code?: string;
};

type FormValues = {
  name: string;
  location: string;
  organizer_id: string;
  starts_at: string;
  entry_limit: string;
  capacity: string;
  header_image: string;
  cover_image: string;
  is_active: boolean;
  code: string;
};

const emptyForm: FormValues = {
  name: "",
  location: "",
  organizer_id: "",
  starts_at: "",
  entry_limit: DEFAULT_ENTRY_LIMIT,
  capacity: "",
  header_image: "",
  cover_image: "",
  is_active: true,
  code: "",
};

export default function EventForm({ mode, initialData }: EventFormProps) {
  const router = useRouter();
  const [organizerOptions, setOrganizerOptions] = useState<Array<{ id: string; name: string; slug?: string | null }>>([]);

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

  useEffect(() => {
    let mounted = true;
    authedFetch("/api/organizers")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        const options = Array.isArray(data?.organizers) ? data.organizers : [];
        setOrganizerOptions(options);
        if (!form.organizer_id && options[0]?.id) {
          setForm((prev) => ({ ...prev, organizer_id: prev.organizer_id || options[0].id }));
        }
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, []);

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
      organizer_id: form.organizer_id,
      header_image: form.header_image.trim(),
      cover_image: form.cover_image.trim(),
      is_active: Boolean(form.is_active),
      code: form.code.trim(),
    };

    try {
      const endpoint = mode === "edit" ? "/api/events/update" : "/api/events/create";
      const res = await authedFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new Error("Auth requerido. Inicia sesión nuevamente en el panel.");
      }
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
    <section className="rounded-3xl border border-[#292929] bg-[#0c0c0c] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:p-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">
            {mode === "edit" ? "Edición" : "Crear"}
          </p>
          <h2 className="text-2xl font-semibold text-white">{header}</h2>
        </div>
        {showReadyBadge && (
          <span className="rounded-full bg-[#111111] px-3 py-1 text-[12px] font-semibold text-[#a60c2f]">
            Cambios listos
          </span>
        )}
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
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
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white" htmlFor="organizer_id">
              Organizador
            </label>
            <SelectNative
              id="organizer_id"
              value={form.organizer_id}
              onChange={(e) => updateField("organizer_id", e.target.value)}
            >
              <option value="">Selecciona organizador</option>
              {organizerOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </SelectNative>
            {errors.organizer_id && <ErrorText message={errors.organizer_id} />}
          </div>
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
            <Input
              id="manifest-url"
              type="url"
              value={form.header_image}
              onChange={(e) => updateField("header_image", e.target.value)}
              placeholder="https://..."
            />
            <ManifestUploader
              code={form.code || form.name}
              onUploaded={(url) => updateField("header_image", url)}
              initialUrl={form.header_image}
            />
            {form.header_image && (
              <div className="overflow-hidden rounded-2xl border border-[#292929] bg-[#0a0a0a] p-2">
                <img src={form.header_image} alt="Manifiesto" className="h-28 w-full rounded-xl object-cover lg:h-32" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-white" htmlFor="cover-url">
              Cover (imagen cabecera)
            </label>
            <Input
              id="cover-url"
              type="url"
              value={form.cover_image}
              onChange={(e) => updateField("cover_image", e.target.value)}
              placeholder="https://..."
            />
            <ManifestUploader
              code={`${form.code || form.name}-cover`}
              onUploaded={(url) => updateField("cover_image", url)}
              initialUrl={form.cover_image}
              label="Subir cover (imagen)"
              inputId="cover-file"
            />
            {form.cover_image && (
              <div className="overflow-hidden rounded-2xl border border-[#292929] bg-[#0a0a0a] p-2">
                <img src={form.cover_image} alt="Cover" className="h-28 w-full rounded-xl object-cover lg:h-32" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white" htmlFor="starts-at">
              Fecha y hora del evento (America/Lima)
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
                  <SelectNative
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
                    className="min-w-[68px]"
                  >
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const h = ((idx + 1) % 13) || 1;
                      return (
                        <option key={h} value={String(h).padStart(2, "0")}>
                          {String(h).padStart(2, "0")}
                        </option>
                      );
                    })}
                  </SelectNative>
                  <SelectNative
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
                    className="min-w-[68px]"
                  >
                    {["00", "15", "30", "45"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </SelectNative>
                  <SelectNative
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
                    className="min-w-[68px]"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </SelectNative>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    const nowIso = DateTime.now().setZone(EVENT_ZONE).toUTC().toISO();
                    if (nowIso) updateField("starts_at", nowIso);
                  }}
                  variant="ghost"
                  size="sm"
                >
                  Ahora
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    let base = DateTime.now().setZone(EVENT_ZONE);
                    if (dateTimeParts.datePart) {
                      const h24 = to24h(Number(dateTimeParts.hour12) || 12, dateTimeParts.period);
                      const d = DateTime.fromFormat(dateTimeParts.datePart, "yyyy-MM-dd", { zone: EVENT_ZONE }).set({
                        hour: h24,
                        minute: Number(dateTimeParts.minute) || 0,
                        second: 0,
                        millisecond: 0,
                      });
                      if (d.isValid) base = d;
                    }
                    const iso = base.plus({ minutes: 30 }).toUTC().toISO();
                    if (iso) updateField("starts_at", iso);
                  }}
                  variant="ghost"
                  size="sm"
                >
                  +30m
                </Button>
              </div>
            </div>
            <p className="text-xs text-white/60">Hora del evento (America/Lima). Se guarda en UTC en la BD.</p>
            {errors.starts_at && <ErrorText message={errors.starts_at} />}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white" htmlFor="entry-limit">
              Hora límite de ingreso (America/Lima)
            </label>
            <Input
              id="entry-limit"
              type="time"
              step={60}
              value={form.entry_limit}
              onChange={(e) => updateField("entry_limit", e.target.value)}
            />
            <p className="text-xs text-white/60">
              Si la hora es menor a la hora del evento, se asume día siguiente.
            </p>
            {errors.entry_limit && <ErrorText message={errors.entry_limit} />}
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
          <div className="rounded-2xl border border-[#2d0b0b] bg-[#1a0a0a] px-4 py-3 text-sm text-[#fca5a5]">
            {serverError}
          </div>
        )}

        <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[#252525] bg-[#0c0c0c] px-3 py-2">
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear evento"}
          </Button>
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
      <Input
        id={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
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
        className="h-5 w-5 rounded border border-white/20 bg-[#0c0c0c] accent-[#a60c2f]"
      />
      <span>{label}</span>
    </label>
  );
}

function ErrorText({ message }: { message: string }) {
  return <p className="text-xs font-semibold text-[#fca5a5]">{message}</p>;
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
    organizer_id: initialData.organizer_id ?? "",
    starts_at: initialData.starts_at ?? "",
    entry_limit: normalizeEntryLimit(initialData.entry_limit) || DEFAULT_ENTRY_LIMIT,
    capacity: initialData.capacity != null ? String(initialData.capacity) : "",
    header_image: initialData.header_image ?? "",
    cover_image: initialData.cover_image ?? "",
    is_active: initialData.is_active ?? true,
    code: initialData.code ?? "",
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
  if (!values.organizer_id.trim()) errors.organizer_id = "Organizador requerido";
  if (!values.starts_at) errors.starts_at = "Selecciona fecha y hora";
  if (!normalizeEntryLimit(values.entry_limit)) errors.entry_limit = "Hora límite inválida";

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
