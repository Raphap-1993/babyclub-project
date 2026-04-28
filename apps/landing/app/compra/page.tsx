/* Compra de mesas/tickets con upload de voucher */
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CreditCard, Smartphone } from "lucide-react";
import TableMap from "../registro/TableMap";
import {
  buildMapSlotsFromTables,
  hasLayoutPosition,
} from "../registro/tableSlotUtils";
import {
  DOCUMENT_TYPES,
  validateDocument,
  type DocumentType,
} from "shared/document";
import {
  normalizeTicketTypesFromEvent,
  type TicketSalePhase,
  type TicketTypeOption,
} from "shared/ticketTypes";
import { loadImageDimensions, optimizeImageUrl } from "lib/imageOptimization";
import { legalLinks } from "lib/legalLinks";
import { useCulqiAvailability } from "lib/useCulqiAvailability";
import { LegalFooterLinks } from "../legal/LegalFooterLinks";
import CulqiCheckout from "../registro/CulqiCheckout";

const CULQI_ENABLED =
  process.env.NEXT_PUBLIC_CULQI_ENABLED?.toLowerCase() === "true";
const CULQI_PUBLIC_KEY = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY ?? "";

type TableRow = {
  id: string;
  event_id?: string | null;
  name: string;
  ticket_count?: number | null;
  min_consumption?: number | null;
  price?: number | null;
  notes?: string | null;
  products?: Array<{
    id: string;
    name: string;
    price?: number | null;
    tickets_included?: number | null;
    description?: string | null;
    items?: string[] | null;
    is_active?: boolean | null;
    sort_order?: number | null;
  }>;
  pos_x?: number | null;
  pos_y?: number | null;
  pos_w?: number | null;
  pos_h?: number | null;
  layout_x?: number | null;
  layout_y?: number | null;
  layout_size?: number | null;
  is_reserved?: boolean | null;
};

type EventOption = {
  id: string;
  organizer_id?: string | null;
  name?: string | null;
  starts_at?: string | null;
  location?: string | null;
  is_active?: boolean | null;
  closed_at?: string | null;
  sale_status?: "on_sale" | "sold_out" | "paused" | null;
  sale_public_message?: string | null;
  early_bird_enabled?: boolean | null;
  early_bird_price_1?: number | null;
  early_bird_price_2?: number | null;
  all_night_price_1?: number | null;
  all_night_price_2?: number | null;
  ticket_types?: TicketTypeOption[];
};

type PaymentMethod = "yape" | "culqi";

export default function CompraPage() {
  return (
    <Suspense>
      <CompraContent />
    </Suspense>
  );
}

function CompraContent() {
  const searchParams = useSearchParams();
  const promoterIdFromUrl = searchParams.get("promoter_id") || null;
  const tabFromUrl = searchParams.get("tab");
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [form, setForm] = useState({
    doc_type: "dni",
    document: "",
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    phone: "",
    voucher_url: "",
  });
  const [formApellidosInput, setFormApellidosInput] = useState("");
  const [ticketForm, setTicketForm] = useState({
    doc_type: "dni",
    document: "",
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    phone: "",
  });
  const [ticketApellidosInput, setTicketApellidosInput] = useState("");
  const formRef = useRef(form);
  const ticketFormRef = useRef(ticketForm);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [mode, setMode] = useState<"mesa" | "ticket">(
    tabFromUrl === "mesa" ? "mesa" : "ticket",
  );
  const [uploading, setUploading] = useState(false);
  const [ticketUploading, setTicketUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [successCodes, setSuccessCodes] = useState<string[] | null>(null);
  const [ticketReservationId, setTicketReservationId] = useState<string | null>(
    null,
  );
  const [layoutUrl, setLayoutUrl] = useState<string | null>(null);
  const [layoutCanvas, setLayoutCanvas] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [layoutImageSize, setLayoutImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showTicketSummary, setShowTicketSummary] = useState(false);
  const [ticketConflictWarning, setTicketConflictWarning] = useState<{
    total: number;
  } | null>(null);
  const [showTicketConfirmation, setShowTicketConfirmation] = useState(false);
  const [showReservationConfirmation, setShowReservationConfirmation] =
    useState(false);
  const [mesaReservationId, setMesaReservationId] = useState<string | null>(
    null,
  );
  const [modalError, setModalError] = useState<string | null>(null);
  const [ticketModalError, setTicketModalError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [ticketCopyFeedback, setTicketCopyFeedback] = useState<
    "idle" | "copied" | "error"
  >("idle");
  // Payment method — 'yape' is always the default; 'culqi' is the additional option
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>("yape");
  const [selectedPaymentMethodTicket, setSelectedPaymentMethodTicket] =
    useState<PaymentMethod>("yape");
  const [mesaLegalAccepted, setMesaLegalAccepted] = useState(false);
  const [ticketLegalAccepted, setTicketLegalAccepted] = useState(false);
  const [culqiOrderId, setCulqiOrderId] = useState<string | null>(null);
  const [culqiPaymentId, setCulqiPaymentId] = useState<string | null>(null);
  const [culqiFlowType, setCulqiFlowType] = useState<"mesa" | "ticket" | null>(
    null,
  );
  const [reservationSubmitted, setReservationSubmitted] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [ticketEventId, setTicketEventId] = useState<string>("");
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [ticketVoucherUrl, setTicketVoucherUrl] = useState<string>("");
  const [ticketQuantity, setTicketQuantity] = useState<1 | 2>(1);
  const [ticketPricingSelection, setTicketPricingSelection] =
    useState<TicketSalePhase>("all_night");
  const [isDragging, setIsDragging] = useState(false);
  const [ticketIsDragging, setTicketIsDragging] = useState(false);
  const defaultCode = process.env.NEXT_PUBLIC_DEFAULT_CODE || "public";
  const dniErrorTicket =
    ticketForm.document &&
    !validateDocument(ticketForm.doc_type as DocumentType, ticketForm.document)
      ? "Documento inválido"
      : "";
  const dniErrorMesa =
    form.document &&
    !validateDocument(form.doc_type as DocumentType, form.document)
      ? "Documento inválido"
      : "";
  const yapeNumber = "950 144 641";
  const yapeHolder = "Kevin Andree Huansi Ruiz";
  const culqiAvailability = useCulqiAvailability(
    CULQI_ENABLED,
    CULQI_PUBLIC_KEY,
  );
  const culqiEnabled = culqiAvailability.enabled;
  const culqiPublicKey = culqiAvailability.publicKey;

  useEffect(() => {
    if (!culqiEnabled) {
      setSelectedPaymentMethod("yape");
      setSelectedPaymentMethodTicket("yape");
    }
  }, [culqiEnabled]);

  const friendlyCulqiError = (raw: string | undefined): string => {
    if (!raw) return "No se pudo iniciar el pago online";
    const r = raw.toLowerCase();
    if (
      r.includes("culqi_secret_key") ||
      r.includes("missing") ||
      r.includes("payments_module_disabled") ||
      r.includes("culqi_public_key")
    )
      return "El pago con tarjeta está en proceso de implementación. Por ahora usa Yape / Plin.";
    return raw;
  };

  const formatPrice = (value?: number | null) => {
    if (value == null) return null;
    return `S/ ${value.toLocaleString("es-PE")}`;
  };

  const splitLastName = (lastName: string) => {
    const parts = lastName.trim().split(/\s+/).filter(Boolean);
    return {
      apellidoPaterno: parts[0] || "",
      apellidoMaterno: parts.slice(1).join(" "),
    };
  };

  const splitSurnameInput = (value: string) => {
    const parts = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    return {
      apellido_paterno: parts[0] || "",
      apellido_materno: parts.slice(1).join(" ") || "",
    };
  };

  const joinSurnameInput = (apellidoPaterno: string, apellidoMaterno: string) =>
    [apellidoPaterno, apellidoMaterno]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    ticketFormRef.current = ticketForm;
  }, [ticketForm]);

  const buildFullName = (
    nombre: string,
    apellidoPaterno: string,
    apellidoMaterno: string,
  ) =>
    [nombre, apellidoPaterno, apellidoMaterno]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");

  const resolveSaleBlock = (eventId?: string | null) => {
    if (!eventId) return null;
    const event = eventOptions.find((ev) => ev.id === eventId);
    if (!event) return null;

    if (event.is_active === false || event.closed_at) {
      return {
        status: "paused" as const,
        message:
          event.sale_public_message ||
          "La venta online para este evento no está disponible.",
      };
    }
    if (event.sale_status === "sold_out") {
      return {
        status: "sold_out" as const,
        message:
          event.sale_public_message ||
          "Entradas agotadas. Este evento está sold out.",
      };
    }
    if (event.sale_status === "paused") {
      return {
        status: "paused" as const,
        message:
          event.sale_public_message ||
          "La venta online está pausada temporalmente.",
      };
    }
    return null;
  };

  const resetTicketForm = () => {
    setTicketForm({
      doc_type: "dni",
      document: "",
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      email: "",
      phone: "",
    });
    setTicketApellidosInput("");
    setTicketError(null);
    setTicketReservationId(null);
  };

  const resetMesaForm = () => {
    setForm({
      doc_type: "dni",
      document: "",
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      email: "",
      phone: "",
      voucher_url: "",
    });
    setFormApellidosInput("");
    setError(null);
    setSuccessCodes(null);
    setMesaReservationId(null);
  };

  const clearTicketInputs = () => {
    resetTicketForm();
    setTicketVoucherUrl("");
    setTicketModalError(null);
    setTicketUploading(false);
    setTicketQuantity(1);
    setTicketPricingSelection("all_night");
  };

  const clearMesaInputs = () => {
    resetMesaForm();
    setReservationSubmitted(false);
    setModalError(null);
    setUploading(false);
  };

  const configuredOrganizerId = process.env.NEXT_PUBLIC_ORGANIZER_ID || "";
  const organizerId =
    eventOptions.find((ev) => ev.id === selectedEventId)?.organizer_id ||
    eventOptions.find((ev) => ev.id === ticketEventId)?.organizer_id ||
    eventOptions.find((ev) => ev.organizer_id)?.organizer_id ||
    configuredOrganizerId;

  // Cargar mesas filtradas por organizador solamente (NO por evento)
  // Las mesas pueden no tener event_id asignado y estar disponibles para todos los eventos del organizador
  useEffect(() => {
    if (!organizerId) {
      setTables([]);
      return;
    }

    const tableParams = new URLSearchParams({ organizer_id: organizerId });
    if (selectedEventId) {
      tableParams.set("event_id", selectedEventId);
    }

    fetch(`/api/tables?${tableParams.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const tables = data?.tables || [];
        setTables(tables);

        // Seleccionar primera mesa disponible
        const hasBackofficeLayout = tables.some(hasLayoutPosition);
        const firstAvailable =
          tables.find(
            (t: any) =>
              !t.is_reserved &&
              (hasBackofficeLayout ? hasLayoutPosition(t) : true),
          ) ||
          tables.find((t: any) => !t.is_reserved) ||
          tables[0];
        if (firstAvailable) {
          setSelected(firstAvailable.id);
          const firstProduct = firstAvailable.products?.find(
            (p: any) => p.is_active !== false,
          );
          setSelectedProduct(firstProduct?.id || "");
        }
      })
      .catch(() => setTables([]));
  }, [organizerId, selectedEventId]);

  // Cargar layout del organizador (NO depende del evento, es del organizador)
  useEffect(() => {
    if (!organizerId) return;

    fetch(`/api/layout?organizer_id=${organizerId}`)
      .then((res) => res.json())
      .then((data) => {
        const optimizedLayoutUrl = optimizeImageUrl(data?.layout_url || null, {
          width: 1600,
          quality: 72,
        });
        setLayoutUrl(optimizedLayoutUrl);
        const width = Number(data?.canvas_width);
        const height = Number(data?.canvas_height);
        const isOrganizerCanvas = data?.canvas_source === "organizer";
        if (
          isOrganizerCanvas &&
          Number.isFinite(width) &&
          width > 0 &&
          Number.isFinite(height) &&
          height > 0
        ) {
          setLayoutCanvas({ width, height });
        } else {
          setLayoutCanvas(null);
        }
        void loadImageDimensions(optimizedLayoutUrl).then((size) =>
          setLayoutImageSize(size),
        );
      })
      .catch(() => {
        setLayoutUrl(null);
        setLayoutCanvas(null);
        setLayoutImageSize(null);
      });
  }, [organizerId]);

  useEffect(() => {
    fetch("/api/events", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const events = Array.isArray(data?.events) ? data.events : [];
        setEventOptions(events);
        if (events.length > 0) {
          setTicketEventId((prev) => prev || events[0]?.id || "");
        }
      })
      .catch(() => setEventOptions([]));
  }, []);

  useEffect(() => {
    if (
      validateDocument(ticketForm.doc_type as DocumentType, ticketForm.document)
    ) {
      lookupPerson(
        ticketForm.document,
        "ticket",
        ticketForm.doc_type as DocumentType,
      );
    }
  }, [ticketForm.doc_type, ticketForm.document]);

  useEffect(() => {
    if (validateDocument(form.doc_type as DocumentType, form.document)) {
      lookupPerson(form.document, "mesa", form.doc_type as DocumentType);
    }
  }, [form.doc_type, form.document]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  const handleFileUpload = async (file: File) => {
    // Validar tipo y tamaño
    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      setModalError("Solo se permiten imágenes JPG, PNG o WEBP");
      return;
    }

    if (file.size > maxSize) {
      setModalError("La imagen no debe superar 5MB");
      return;
    }

    setUploading(true);
    setError(null);
    setModalError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tableName", selected || "mesa");
    try {
      const res = await fetch("/api/uploads/voucher", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setModalError(data?.error || "No se pudo subir el voucher");
      } else {
        setForm((prev) => ({ ...prev, voucher_url: data.url }));
      }
    } catch (err: any) {
      setModalError(err?.message || "Error al subir voucher");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleTicketFileUpload = async (file: File) => {
    // Validar tipo y tamaño
    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      setTicketModalError("Solo se permiten imágenes JPG, PNG o WEBP");
      return;
    }

    if (file.size > maxSize) {
      setTicketModalError("La imagen no debe superar 5MB");
      return;
    }

    setTicketUploading(true);
    setTicketModalError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tableName", "ticket");
    try {
      const res = await fetch("/api/uploads/voucher", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setTicketModalError(data?.error || "No se pudo subir el voucher");
      } else {
        setTicketVoucherUrl(data.url);
      }
    } catch (err: any) {
      setTicketModalError(err?.message || "Error al subir voucher");
    } finally {
      setTicketUploading(false);
    }
  };

  const handleTicketDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTicketIsDragging(true);
  };

  const handleTicketDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTicketIsDragging(false);
  };

  const handleTicketDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTicketIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleTicketFileUpload(file);
    }
  };

  const lookupPerson = async (
    document: string,
    target: "ticket" | "mesa",
    docType: DocumentType = "dni",
  ) => {
    try {
      // /api/persons ya hace el lookup en BD primero y solo consulta RENIEC si no existe
      // Esto evita consumir el token de API Perú innecesariamente
      const res = await fetch(
        `/api/persons?document=${encodeURIComponent(document)}&doc_type=${docType}`,
      );
      const data = await res.json().catch(() => ({}));
      const person = res.ok ? data?.person : null;

      if (!person) return;

      const { apellidoPaterno, apellidoMaterno } = splitLastName(
        person.last_name || "",
      );
      const nombre = person.first_name || "";
      if (target === "ticket") {
        const currentTicketForm = ticketFormRef.current;
        const nextForm = {
          ...currentTicketForm,
          nombre: currentTicketForm.nombre || nombre,
          apellido_paterno:
            currentTicketForm.apellido_paterno || apellidoPaterno,
          apellido_materno:
            currentTicketForm.apellido_materno || apellidoMaterno,
          email: currentTicketForm.email || person.email || "",
          phone: currentTicketForm.phone || person.phone || "",
        };
        setTicketForm(nextForm);
        setTicketApellidosInput(
          joinSurnameInput(
            nextForm.apellido_paterno,
            nextForm.apellido_materno,
          ),
        );
      } else {
        const currentForm = formRef.current;
        const nextForm = {
          ...currentForm,
          doc_type: currentForm.doc_type || docType,
          document: currentForm.document || document,
          nombre: currentForm.nombre || nombre,
          apellido_paterno: currentForm.apellido_paterno || apellidoPaterno,
          apellido_materno: currentForm.apellido_materno || apellidoMaterno,
          email: currentForm.email || person.email || "",
          phone: currentForm.phone || person.phone || "",
        };
        setForm(nextForm);
        setFormApellidosInput(
          joinSurnameInput(
            nextForm.apellido_paterno,
            nextForm.apellido_materno,
          ),
        );
      }
    } catch (_err) {
      // ignore
    }
  };

  const ticketSelectedEventData = eventOptions.find(
    (ev) => ev.id === ticketEventId,
  );
  const ticketTypeOptions = useMemo(
    () =>
      ticketSelectedEventData
        ? normalizeTicketTypesFromEvent(ticketSelectedEventData)
        : [],
    [ticketSelectedEventData],
  );
  const selectedTicketType = ticketTypeOptions.find(
    (option) =>
      option.salePhase === ticketPricingSelection &&
      option.ticketQuantity === ticketQuantity,
  );

  useEffect(() => {
    if (ticketTypeOptions.length === 0) return;
    const stillAvailable = ticketTypeOptions.some(
      (option) =>
        option.salePhase === ticketPricingSelection &&
        option.ticketQuantity === ticketQuantity,
    );
    if (!stillAvailable) {
      const first = ticketTypeOptions[0];
      setTicketPricingSelection(first.salePhase);
      setTicketQuantity(first.ticketQuantity === 2 ? 2 : 1);
    }
  }, [ticketPricingSelection, ticketQuantity, ticketTypeOptions]);

  // header text tweak
  const headerSubtitle = culqiEnabled
    ? "Genera tu entrada o reserva tu mesa pagando con Yape/Plin o tarjeta."
    : "Genera tu entrada o reserva tu mesa con Yape/Plin; el pago online está en integración.";
  const ticketPrice =
    selectedTicketType?.price ?? ticketTypeOptions[0]?.price ?? 0;
  const ticketSaleLabel =
    selectedTicketType?.label ??
    (ticketPricingSelection === "early_bird" ? "EARLY BABY" : "ALL NIGHT");
  const ticketFullName = buildFullName(
    ticketForm.nombre,
    ticketForm.apellido_paterno,
    ticketForm.apellido_materno,
  );
  const mesaFullName = buildFullName(
    form.nombre,
    form.apellido_paterno,
    form.apellido_materno,
  );
  const ticketNameComplete = Boolean(
    ticketForm.nombre.trim() &&
      ticketForm.apellido_paterno.trim() &&
      ticketForm.apellido_materno.trim(),
  );
  const mesaNameComplete = Boolean(
    form.nombre.trim() &&
      form.apellido_paterno.trim() &&
      form.apellido_materno.trim(),
  );

  // sincronia de datos entre solo entrada y reserva
  useEffect(() => {
    if (mode === "mesa") {
      const currentForm = formRef.current;
      const currentTicketForm = ticketFormRef.current;
      const nextForm = {
        ...currentForm,
        doc_type: currentForm.doc_type || currentTicketForm.doc_type,
        document: currentForm.document || currentTicketForm.document,
        nombre: currentForm.nombre || currentTicketForm.nombre,
        apellido_paterno:
          currentForm.apellido_paterno || currentTicketForm.apellido_paterno,
        apellido_materno:
          currentForm.apellido_materno || currentTicketForm.apellido_materno,
        email: currentForm.email || currentTicketForm.email,
        phone: currentForm.phone || currentTicketForm.phone,
      };
      setForm(nextForm);
      setFormApellidosInput(
        joinSurnameInput(nextForm.apellido_paterno, nextForm.apellido_materno),
      );
    } else if (mode === "ticket") {
      const currentForm = formRef.current;
      const currentTicketForm = ticketFormRef.current;
      const nextTicketForm = {
        ...currentTicketForm,
        doc_type: currentTicketForm.doc_type || currentForm.doc_type,
        document: currentTicketForm.document || currentForm.document,
        nombre: currentTicketForm.nombre || currentForm.nombre,
        apellido_paterno:
          currentTicketForm.apellido_paterno || currentForm.apellido_paterno,
        apellido_materno:
          currentTicketForm.apellido_materno || currentForm.apellido_materno,
        email: currentTicketForm.email || currentForm.email,
        phone: currentTicketForm.phone || currentForm.phone,
      };
      setTicketForm(nextTicketForm);
      setTicketApellidosInput(
        joinSurnameInput(
          nextTicketForm.apellido_paterno,
          nextTicketForm.apellido_materno,
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleOpenSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setModalError(null);
    setSuccessCodes(null);
    setCopyFeedback("idle");
    setReservationSubmitted(false);
    setTicketConflictWarning(null);

    if (mesaEventOptions.length > 0 && !selectedEventId) {
      setError("Selecciona el evento para esta reserva");
      return;
    }
    if (
      !selected ||
      !validateDocument(form.doc_type as DocumentType, form.document) ||
      !mesaNameComplete
    ) {
      setError("Selecciona una mesa e ingresa documento, nombres y apellidos");
      return;
    }
    if (!selectedProduct) {
      setError("Selecciona un pack de consumo");
      return;
    }
    if (mesaSaleBlock) {
      setError(mesaSaleBlock.message);
      return;
    }
    if (!mesaLegalAccepted) {
      setError("Acepta los términos y políticas para continuar.");
      return;
    }

    // Verificar si el cliente ya tiene entradas compradas para este evento
    const eventIdForCheck =
      selectedEventId || tables.find((t) => t.id === selected)?.event_id || "";
    if (eventIdForCheck && form.document) {
      try {
        const checkRes = await fetch(
          `/api/check-ticket-reservation?event_id=${encodeURIComponent(eventIdForCheck)}&document=${encodeURIComponent(form.document.trim().toLowerCase())}`,
        );
        const checkData = await checkRes.json();
        if (
          checkData.success &&
          checkData.has_ticket_reservations &&
          checkData.total_tickets > 0
        ) {
          setTicketConflictWarning({ total: checkData.total_tickets });
          return; // Mostrar el warning en lugar de continuar
        }
      } catch (_) {
        // Si el check falla, continuar igual (no bloquear)
      }
    }

    setShowSummary(true);
  };

  const confirmReservation = async () => {
    setModalError(null);
    setError(null);
    setReservationSubmitted(false);

    const useCulqi =
      culqiEnabled &&
      typeof totalPrice === "number" &&
      totalPrice > 0 &&
      selectedPaymentMethod === "culqi";

    if (!useCulqi && !form.voucher_url) {
      setModalError("Sube tu comprobante de pago para continuar.");
      return;
    }
    if (
      !selected ||
      !validateDocument(form.doc_type as DocumentType, form.document) ||
      !mesaNameComplete
    ) {
      setModalError(
        "Revisa los datos obligatorios: mesa, documento, nombres y apellidos.",
      );
      return;
    }
    if (mesaSaleBlock) {
      setModalError(mesaSaleBlock.message);
      return;
    }

    setLoading(true);
    const tableInfo = tables.find((t) => t.id === selected);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_id: selected,
          doc_type: form.doc_type,
          document: form.document,
          full_name: mesaFullName,
          email: form.email,
          phone: form.phone,
          product_id: selectedProduct || null,
          event_id: selectedEventId || tableInfo?.event_id || null,
          code: defaultCode,
          voucher_url: form.voucher_url || undefined,
          payment_method: useCulqi ? "culqi" : "yape",
          promoter_id: promoterIdFromUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setModalError(data?.error || "No se pudo registrar la reserva");
      } else if (useCulqi && data.reservationId) {
        const amountCentavos = Math.round((totalPrice as number) * 100);
        const orderRes = await fetch("/api/payments/culqi/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservation_id: data.reservationId,
            amount: amountCentavos,
            idempotency_key: `res-${data.reservationId}`,
          }),
        });
        const orderData = await orderRes.json().catch(() => ({}));
        if (!orderRes.ok || !orderData?.orderId) {
          setModalError(friendlyCulqiError(orderData?.error));
        } else {
          setMesaReservationId(data.reservationId);
          setCulqiOrderId(orderData.orderId);
          setCulqiPaymentId(orderData.paymentId);
          setCulqiFlowType("mesa");
          setShowSummary(false);
        }
      } else {
        setSuccessCodes(data.codes || []);
        setReservationSubmitted(true);
        setMesaReservationId(data.reservationId || null);
        setShowSummary(false);
        setShowReservationConfirmation(true);
      }
    } catch (err: any) {
      setModalError(err?.message || "Error al registrar reserva");
    } finally {
      setLoading(false);
    }
  };

  const copyYapeNumber = () => {
    try {
      const text = yapeNumber.replace(/\s/g, "");
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyFeedback("copied");
      setTimeout(() => setCopyFeedback("idle"), 1800);
    } catch (_err) {
      setCopyFeedback("error");
    }
  };

  const copyYapeNumberTicket = () => {
    try {
      const text = yapeNumber.replace(/\s/g, "");
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setTicketCopyFeedback("copied");
      setTimeout(() => setTicketCopyFeedback("idle"), 1800);
    } catch (_err) {
      setTicketCopyFeedback("error");
    }
  };

  const onSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    handleOpenTicketSummary(e);
  };

  const handleOpenTicketSummary = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError(null);
    setTicketModalError(null);
    setTicketReservationId(null);
    if (ticketRequiresEvent && !ticketEventId) {
      setTicketError("Selecciona el evento");
      return;
    }
    if (
      !validateDocument(
        ticketForm.doc_type as DocumentType,
        ticketForm.document,
      ) ||
      !ticketNameComplete
    ) {
      setTicketError("Ingresa documento, nombres y apellidos");
      return;
    }
    if (ticketSaleBlock) {
      setTicketError(ticketSaleBlock.message);
      return;
    }
    if (!selectedTicketType) {
      setTicketError("Selecciona un tipo de entrada disponible.");
      return;
    }
    if (!ticketLegalAccepted) {
      setTicketError("Acepta los términos y políticas para continuar.");
      return;
    }
    setShowTicketSummary(true);
  };

  const confirmTicketPurchase = async () => {
    setTicketModalError(null);
    setTicketError(null);
    if (ticketRequiresEvent && !ticketEventId) {
      setTicketModalError("Selecciona el evento");
      return;
    }
    if (
      !validateDocument(
        ticketForm.doc_type as DocumentType,
        ticketForm.document,
      ) ||
      !ticketNameComplete
    ) {
      setTicketModalError("Ingresa documento, nombres y apellidos");
      return;
    }
    if (ticketSaleBlock) {
      setTicketModalError(ticketSaleBlock.message);
      return;
    }
    if (!selectedTicketType) {
      setTicketModalError("Selecciona un tipo de entrada disponible.");
      return;
    }
    const useCulqi = culqiEnabled && selectedPaymentMethodTicket === "culqi";
    if (!useCulqi && !ticketVoucherUrl) {
      setTicketModalError("Sube tu comprobante de pago para continuar.");
      return;
    }
    setTicketLoading(true);
    try {
      const payload: Record<string, unknown> = {
        event_id: ticketEventId,
        doc_type: ticketForm.doc_type,
        document: ticketForm.document,
        nombre: ticketForm.nombre,
        apellido_paterno: ticketForm.apellido_paterno,
        apellido_materno: ticketForm.apellido_materno,
        email: ticketForm.email,
        telefono: ticketForm.phone,
        voucher_url: ticketVoucherUrl || undefined,
        ticket_type_code: selectedTicketType.code,
        ticket_quantity: ticketQuantity,
        pricing_phase: ticketPricingSelection,
        payment_method: useCulqi ? "culqi" : "yape",
        promoter_id: promoterIdFromUrl || undefined,
      };
      const res = await fetch("/api/ticket-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setTicketModalError(data?.error || "No se pudo registrar la reserva");
      } else if (useCulqi && data.reservationId && data.amount) {
        const amountCentavos =
          typeof data.amount_cents === "number"
            ? data.amount_cents
            : Math.round((data.amount as number) * 100);
        const orderRes = await fetch("/api/payments/culqi/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservation_id: data.reservationId,
            amount: amountCentavos,
            idempotency_key: `tkt-res-${data.reservationId}`,
          }),
        });
        const orderData = await orderRes.json().catch(() => ({}));
        if (!orderRes.ok || !orderData?.orderId) {
          setTicketModalError(friendlyCulqiError(orderData?.error));
        } else {
          setTicketReservationId(data.reservationId);
          setCulqiOrderId(orderData.orderId);
          setCulqiPaymentId(orderData.paymentId);
          setCulqiFlowType("ticket");
          setShowTicketSummary(false);
        }
      } else {
        setTicketReservationId(data.reservationId || null);
        setShowTicketSummary(false);
        setShowTicketConfirmation(true);
      }
    } catch (err: any) {
      setTicketModalError(err?.message || "Error al registrar reserva");
    } finally {
      setTicketLoading(false);
    }
  };

  const tableInfo = tables.find((t) => t.id === selected);
  const tableSlots = useMemo(
    () =>
      buildMapSlotsFromTables(tables, {
        canvasWidth: layoutCanvas?.width ?? null,
        canvasHeight: layoutCanvas?.height ?? null,
        imageWidth: layoutImageSize?.width ?? null,
        imageHeight: layoutImageSize?.height ?? null,
      }),
    [tables, layoutCanvas, layoutImageSize],
  );
  const activeProducts = (
    tableInfo?.products?.filter((p) => p.is_active !== false) || []
  ).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const selectedProductInfo = activeProducts.find(
    (p) => p.id === selectedProduct,
  );
  const totalPrice =
    selectedProductInfo?.price ??
    tableInfo?.price ??
    tableInfo?.min_consumption ??
    null;
  const canUseCulqiForMesa =
    culqiEnabled && typeof totalPrice === "number" && totalPrice > 0;
  const canUseCulqiForTicket = culqiEnabled && ticketPrice > 0;
  const isMesaCulqiSelected =
    canUseCulqiForMesa && selectedPaymentMethod === "culqi";
  const isTicketCulqiSelected =
    canUseCulqiForTicket && selectedPaymentMethodTicket === "culqi";
  const reservationDone = !!(successCodes && successCodes.length > 0);
  const totalLabel = formatPrice(totalPrice);
  const eventsFromTables: EventOption[] = Array.from(
    new Map(
      tables
        .map((t) => {
          const eventRel = Array.isArray((t as any).event)
            ? (t as any).event?.[0]
            : (t as any).event;
          return t.event_id || eventRel?.id
            ? {
                id: t.event_id || eventRel?.id,
                name:
                  eventRel?.name ||
                  `Evento ${(t.event_id || eventRel?.id || "").slice(0, 6)}`,
              }
            : null;
        })
        .filter(Boolean)
        .map((e: any) => [e.id, e]),
    ).values(),
  );
  const mesaEventOptions =
    eventsFromTables.length > 0 ? eventsFromTables : eventOptions;
  const ticketEventOptions =
    eventOptions.length > 0 ? eventOptions : eventsFromTables;
  const ticketSelectedEvent = ticketEventOptions.find(
    (ev) => ev.id === ticketEventId,
  );
  const ticketSaleBlock = resolveSaleBlock(ticketEventId);
  const mesaSaleBlock = resolveSaleBlock(
    selectedEventId || tableInfo?.event_id || null,
  );
  const ticketRequiresEvent = ticketEventOptions.length > 0;
  const firstTicketEventId = ticketEventOptions[0]?.id || "";

  useEffect(() => {
    if (!ticketEventId && firstTicketEventId) {
      setTicketEventId(firstTicketEventId);
    }
  }, [ticketEventId, firstTicketEventId]);

  useEffect(() => {
    if (!canUseCulqiForMesa && selectedPaymentMethod === "culqi") {
      setSelectedPaymentMethod("yape");
    }
  }, [canUseCulqiForMesa, selectedPaymentMethod]);

  useEffect(() => {
    if (!canUseCulqiForTicket && selectedPaymentMethodTicket === "culqi") {
      setSelectedPaymentMethodTicket("yape");
    }
  }, [canUseCulqiForTicket, selectedPaymentMethodTicket]);

  return (
    <main className="flex min-h-screen items-start justify-center bg-black px-3 py-4 text-white sm:px-6 lg:px-8 lg:py-6">
      <div className="w-full min-w-0 max-w-6xl space-y-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0f0f0f] to-[#050505] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              BABY
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Compra / Reserva
            </h1>
            <p className="text-sm text-white/60">{headerSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-full px-4 py-2 text-sm font-semibold btn-smoke-outline transition"
          >
            ← Volver
          </button>
        </div>

        <div className={mode === "mesa" ? "hidden" : ""}>
          <LegalComplianceStrip />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("ticket")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "ticket" ? "btn-smoke" : "btn-smoke-outline"
            }`}
          >
            Solo entrada
          </button>
          <button
            type="button"
            onClick={() => setMode("mesa")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "mesa" ? "btn-smoke" : "btn-smoke-outline"
            }`}
          >
            Reserva mesa
          </button>
        </div>

        {mode === "ticket" && (
          <form
            onSubmit={onSubmitTicket}
            className="space-y-4 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4"
          >
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                {ticketTypeOptions.length > 0 ? (
                  ticketTypeOptions.map((option) => {
                    const selected =
                      option.salePhase === ticketPricingSelection &&
                      option.ticketQuantity === ticketQuantity;
                    return (
                      <label
                        key={option.code}
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          selected
                            ? "border-[#e91e63]/60 bg-[#e91e63]/10 text-white"
                            : "border-white/10 bg-[#0a0a0a] text-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="ticketQty"
                          checked={selected}
                          onChange={() => {
                            setTicketPricingSelection(option.salePhase);
                            setTicketQuantity(
                              option.ticketQuantity === 2 ? 2 : 1,
                            );
                          }}
                          className="mt-1 h-4 w-4 shrink-0 accent-[#e91e63]"
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span>{option.label}</span>
                            <span className="text-[#e91e63]">
                              S/ {option.price}
                            </span>
                          </span>
                          {option.description ? (
                            <span className="text-xs font-normal text-white/70">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-white/60 md:col-span-2">
                    Selecciona un evento con entradas disponibles.
                  </div>
                )}
              </div>
            </div>
            {ticketEventOptions.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  Evento
                </label>
                <select
                  value={ticketEventId}
                  onChange={(e) => setTicketEventId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white focus:border-white focus:outline-none"
                >
                  <option value="">Selecciona el evento</option>
                  {ticketEventOptions.map((ev) => (
                    <option
                      key={ev.id}
                      value={ev.id}
                      disabled={Boolean(resolveSaleBlock(ev.id))}
                    >
                      {ev.name || `Evento ${ev.id.slice(0, 6)}`}
                      {resolveSaleBlock(ev.id)?.status === "sold_out"
                        ? " (Sold out)"
                        : resolveSaleBlock(ev.id)?.status === "paused"
                          ? " (Pausado)"
                          : ""}
                    </option>
                  ))}
                </select>
                {!ticketEventId && (
                  <p className="text-xs text-[#ff9a9a]">
                    Selecciona el evento para continuar.
                  </p>
                )}
                {ticketSaleBlock && (
                  <p className="text-xs font-semibold text-[#ff9a9a]">
                    {ticketSaleBlock.message}
                  </p>
                )}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-[0.55fr,1fr,1.45fr]">
              <label className="block space-y-2 text-sm font-semibold text-white">
                Tipo de documento
                <select
                  value={ticketForm.doc_type as DocumentType}
                  onChange={(e) =>
                    setTicketForm((p) => ({
                      ...p,
                      doc_type: e.target.value as DocumentType,
                      document: "",
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white focus:border-white focus:outline-none"
                >
                  {DOCUMENT_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Número de documento"
                value={ticketForm.document}
                onChange={(v) => setTicketForm((p) => ({ ...p, document: v }))}
                inputMode={
                  ticketForm.doc_type === "dni" || ticketForm.doc_type === "ruc"
                    ? "numeric"
                    : "text"
                }
                digitOnly={
                  ticketForm.doc_type === "dni" || ticketForm.doc_type === "ruc"
                }
                maxLength={
                  ticketForm.doc_type === "dni"
                    ? 8
                    : ticketForm.doc_type === "ruc"
                      ? 11
                      : 12
                }
                required
                error={dniErrorTicket}
                allowClear
                onClear={resetTicketForm}
              />
              <Field
                label="Nombres"
                value={ticketForm.nombre}
                onChange={(v) => setTicketForm((p) => ({ ...p, nombre: v }))}
                required
              />
            </div>
            <Field
              label="Apellidos"
              value={ticketApellidosInput}
              onChange={(v) => {
                const parts = splitSurnameInput(v);
                setTicketApellidosInput(v);
                setTicketForm((p) => ({
                  ...p,
                  ...parts,
                }));
              }}
              onBlur={() =>
                setTicketApellidosInput(
                  joinSurnameInput(
                    ticketForm.apellido_paterno,
                    ticketForm.apellido_materno,
                  ),
                )
              }
              placeholder="Apellido paterno y materno"
              required
            />
            <div className="grid gap-3 md:grid-cols-[1.3fr,0.7fr]">
              <Field
                label="Email"
                value={ticketForm.email}
                onChange={(v) => setTicketForm((p) => ({ ...p, email: v }))}
                type="email"
              />
              <Field
                label="Teléfono"
                value={ticketForm.phone}
                onChange={(v) => setTicketForm((p) => ({ ...p, phone: v }))}
                placeholder="+51 999 999 999"
              />
            </div>
            <PaymentMethodSelector
              title="Método de pago"
              value={selectedPaymentMethodTicket}
              onChange={setSelectedPaymentMethodTicket}
              culqiAvailable={canUseCulqiForTicket}
              amountLabel={ticketPrice > 0 ? `S/ ${ticketPrice}` : null}
            />
            <LegalAcceptance
              checked={ticketLegalAccepted}
              onChange={setTicketLegalAccepted}
            />
            {ticketError && (
              <p className="text-xs font-semibold text-[#ff9a9a]">
                {ticketError}
              </p>
            )}
            {ticketReservationId && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-white">
                Solicitud enviada. El equipo BABY validará tu pago y recibirás
                la confirmación en tu bandeja de correo.
              </div>
            )}
            <button
              type="submit"
              disabled={
                ticketLoading || Boolean(ticketSaleBlock) || !selectedTicketType
              }
              className="w-full rounded-full px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-smoke transition disabled:opacity-70"
            >
              {ticketLoading
                ? "Procesando..."
                : ticketSaleBlock
                  ? "Venta bloqueada"
                  : !selectedTicketType
                    ? "Sin entradas disponibles"
                    : "Revisar pago y enviar"}
            </button>
            <button
              type="button"
              onClick={() => {
                const currentForm = formRef.current;
                const currentTicketForm = ticketFormRef.current;
                const nextForm = {
                  ...currentForm,
                  doc_type: currentForm.doc_type || currentTicketForm.doc_type,
                  document: currentForm.document || currentTicketForm.document,
                  nombre: currentForm.nombre || currentTicketForm.nombre,
                  apellido_paterno:
                    currentForm.apellido_paterno ||
                    currentTicketForm.apellido_paterno,
                  apellido_materno:
                    currentForm.apellido_materno ||
                    currentTicketForm.apellido_materno,
                  email: currentForm.email || currentTicketForm.email,
                  phone: currentForm.phone || currentTicketForm.phone,
                };
                setForm(nextForm);
                setFormApellidosInput(
                  joinSurnameInput(
                    nextForm.apellido_paterno,
                    nextForm.apellido_materno,
                  ),
                );
                setMode("mesa");
              }}
              className="relative w-full overflow-hidden rounded-full px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-attention-red transition"
            >
              Quiero reservar mesa (opcional)
            </button>
          </form>
        )}

        {mode === "mesa" && (
          <form onSubmit={handleOpenSummary} className="space-y-3">
            <div className="mx-auto grid w-full max-w-4xl min-w-0 grid-cols-1 gap-3">
              <section className="order-1 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c] text-xs text-white/70">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">Plano de mesas</p>
                    <p className="truncate text-[11px] text-white/45">
                      Elige una mesa en el mapa o desde el panel.
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 text-[9px] uppercase tracking-[0.1em] text-white/45 sm:flex">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full border border-white/30 bg-white/10" />
                      Libre
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full border border-[#e91e63] bg-[#e91e63]" />
                      Seleccionada
                    </span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 p-2 sm:p-3">
                  <div className="h-[42svh] min-h-[320px] max-h-[380px] w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-white/10 bg-black/20 sm:h-[min(58svh,560px)] sm:min-h-[320px] sm:max-h-none">
                    <TableMap
                      slots={tableSlots}
                      selectedTableId={selected}
                      onSelect={(id) => {
                        setSelected(id);
                        const next = tables.find((t) => t.id === id);
                        const firstProd = next?.products?.find(
                          (p) => p.is_active !== false,
                        );
                        setSelectedProduct(firstProd?.id || "");
                      }}
                      layoutUrl={layoutUrl || undefined}
                      viewBoxOverride={layoutCanvas}
                      enableZoom={false}
                      loading={tables.length === 0}
                      labelMode="number"
                      minSlotSizePx={0}
                      minSlotScreenPx={14}
                      focusOnSlots={false}
                    />
                  </div>
                </div>
                {tableSlots.length === 0 && (
                  <p className="shrink-0 border-t border-white/10 px-3 py-2 text-[11px] text-white/50">
                    No hay mesas posicionadas en el croquis del organizador.
                  </p>
                )}
              </section>

              <aside className="order-2 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]">
                <div className="shrink-0 border-b border-white/10 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                    Mesas
                  </p>
                  {selected && tableInfo ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e91e63]/50 bg-[#e91e63]/10 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff77ad]">
                          Mesa seleccionada
                        </p>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <p className="truncate text-xl font-bold text-white">
                            {tableInfo.name}
                          </p>
                          {totalLabel && (
                            <p className="text-sm font-semibold text-[#ff77ad]">
                              {totalLabel}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected("");
                          setSelectedProduct("");
                        }}
                        className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div className="grid max-h-[122px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                      {tables.map((t) => {
                        const eventRel = Array.isArray((t as any)?.event)
                          ? (t as any)?.event?.[0]
                          : (t as any)?.event;
                        const evId = t.event_id || eventRel?.id || "";
                        const isReserved = !!t.is_reserved;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (isReserved) return;
                              setSelected(t.id);
                              const firstProd = t.products?.find(
                                (p) => p.is_active !== false,
                              );
                              setSelectedProduct(firstProd?.id || "");
                              if (evId) setSelectedEventId(evId);
                            }}
                            disabled={isReserved}
                            className={`h-9 min-w-0 rounded-full px-2 text-xs font-semibold ${
                              isReserved
                                ? "cursor-not-allowed border border-white/10 bg-white/5 text-white/40"
                                : "border border-[#f2f2f2]/40 text-[#f2f2f2] transition hover:border-[#e91e63] hover:text-white"
                            }`}
                          >
                            <span className="block truncate">{t.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-3">
                  <section className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                    <p className="mb-2 text-sm font-semibold text-white">
                      Packs de consumo
                    </p>
                    {activeProducts.length > 0 ? (
                      <div className="grid gap-2">
                        {activeProducts.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setSelectedProduct(p.id)}
                            className={`rounded-xl border p-3 text-left ${
                              selectedProduct === p.id
                                ? "border-[#e91e63] bg-[#e91e63]/10 text-white"
                                : "border-[#f2f2f2]/30 bg-black/40 text-[#f2f2f2]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">
                                  {p.name}
                                </div>
                                {p.tickets_included != null && (
                                  <div>
                                    Incluye {p.tickets_included} tickets
                                  </div>
                                )}
                              </div>
                              {p.price != null && (
                                <div className="shrink-0 text-sm font-semibold text-[#e91e63]">
                                  S/ {p.price}
                                </div>
                              )}
                            </div>
                            {p.items && p.items.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {p.items.map((item, idx) => (
                                  <li key={idx}>• {item}</li>
                                ))}
                              </ul>
                            )}
                            {p.description && (
                              <div className="mt-2 text-white/60">
                                {p.description}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/60">
                        Selecciona una mesa para ver sus packs disponibles.
                      </p>
                    )}
                  </section>

                  {mesaEventOptions.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-white">
                        Evento
                      </label>
                      <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-3 text-sm text-white focus:border-white focus:outline-none"
                      >
                        <option value="">Selecciona el evento</option>
                        {mesaEventOptions.map((ev) => (
                          <option
                            key={ev.id}
                            value={ev.id}
                            disabled={Boolean(resolveSaleBlock(ev.id))}
                          >
                            {ev.name || `Evento ${ev.id.slice(0, 6)}`}
                            {resolveSaleBlock(ev.id)?.status === "sold_out"
                              ? " (Sold out)"
                              : resolveSaleBlock(ev.id)?.status === "paused"
                                ? " (Pausado)"
                                : ""}
                          </option>
                        ))}
                      </select>
                      {!selectedEventId && (
                        <p className="text-xs text-[#ff9a9a]">
                          Selecciona el evento para continuar.
                        </p>
                      )}
                      {mesaSaleBlock && (
                        <p className="text-xs font-semibold text-[#ff9a9a]">
                          {mesaSaleBlock.message}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid min-w-0 gap-3 sm:grid-cols-[120px_1fr] lg:grid-cols-[120px_1fr]">
                    <label className="block space-y-2 text-sm font-semibold text-white">
                      Tipo doc
                      <select
                        value={form.doc_type as DocumentType}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            doc_type: e.target.value as DocumentType,
                            document: "",
                          }))
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-base text-white focus:border-white focus:outline-none"
                      >
                        {DOCUMENT_TYPES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="Número de documento"
                      value={form.document}
                      onChange={(v) => setForm((p) => ({ ...p, document: v }))}
                      inputMode={
                        form.doc_type === "dni" || form.doc_type === "ruc"
                          ? "numeric"
                          : "text"
                      }
                      digitOnly={
                        form.doc_type === "dni" || form.doc_type === "ruc"
                      }
                      maxLength={
                        form.doc_type === "dni"
                          ? 8
                          : form.doc_type === "ruc"
                            ? 11
                            : 12
                      }
                      required
                      error={dniErrorMesa}
                      allowClear
                      onClear={resetMesaForm}
                    />
                  </div>

                  <Field
                    label="Nombres"
                    value={form.nombre}
                    onChange={(v) => setForm((p) => ({ ...p, nombre: v }))}
                    required
                  />

                  <Field
                    label="Apellidos (paterno y materno)"
                    value={formApellidosInput}
                    onChange={(v) => {
                      const parts = splitSurnameInput(v);
                      setFormApellidosInput(v);
                      setForm((p) => ({
                        ...p,
                        ...parts,
                      }));
                    }}
                    onBlur={() =>
                      setFormApellidosInput(
                        joinSurnameInput(
                          form.apellido_paterno,
                          form.apellido_materno,
                        ),
                      )
                    }
                    placeholder="Ej: García López"
                    required
                  />

                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-2">
                    <Field
                      label="Email"
                      value={form.email}
                      onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                      type="email"
                    />
                    <Field
                      label="Teléfono"
                      value={form.phone}
                      onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                      placeholder="+51 999 999 999"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
                    {isMesaCulqiSelected
                      ? "Verás el recuento y luego continuarás al pago online."
                      : "Subirás el comprobante y verás el recuento antes de enviar la reserva."}
                  </div>
                  <PaymentMethodSelector
                    title="Método de pago"
                    value={selectedPaymentMethod}
                    onChange={setSelectedPaymentMethod}
                    culqiAvailable={canUseCulqiForMesa}
                    amountLabel={totalLabel}
                    compact
                  />
                  <LegalAcceptance
                    checked={mesaLegalAccepted}
                    onChange={setMesaLegalAccepted}
                  />

                  {error && (
                    <p className="text-xs font-semibold text-[#ff9a9a]">
                      {error}
                    </p>
                  )}

                  {ticketConflictWarning && (
                    <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <p className="text-sm font-semibold text-amber-300">
                        Ya tienes {ticketConflictWarning.total} entrada
                        {ticketConflictWarning.total !== 1 ? "s" : ""} compradas
                        para este evento
                      </p>
                      <p className="text-xs text-amber-200/70">
                        Si reservas una mesa, puede que estés pagando dos veces
                        por las mismas entradas. ¿Quieres continuar de todas
                        formas?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTicketConflictWarning(null);
                            setShowSummary(true);
                          }}
                          className="flex-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/30"
                        >
                          Continuar igual
                        </button>
                        <button
                          type="button"
                          onClick={() => setTicketConflictWarning(null)}
                          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 bg-[#050505]/95 p-3">
                  <button
                    type="submit"
                    disabled={loading || Boolean(mesaSaleBlock)}
                    className="w-full rounded-full px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide btn-smoke transition disabled:opacity-70"
                  >
                    {loading
                      ? "Procesando..."
                      : mesaSaleBlock
                        ? "Reserva bloqueada"
                        : "Revisar pago y enviar"}
                  </button>
                </div>
              </aside>
            </div>
          </form>
        )}

        {mode !== "mesa" && (
          <LegalFooterLinks className="border-t border-white/10 pt-4" />
        )}
      </div>

      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:items-center">
          <div className="relative w-full max-w-2xl space-y-4 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                  Revisión
                </p>
                <h3 className="text-2xl font-semibold text-white">
                  Recuento y pago
                </h3>
                <p className="text-sm text-white/60">
                  Confirma tu pedido y elige cómo pagar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSummary(false);
                }}
                className="rounded-full px-3 py-1 text-xs font-semibold btn-smoke-outline transition"
              >
                Editar datos
              </button>
            </div>

            <ModalJumpTabs
              tabs={[
                { label: "Resumen", targetId: "compra-mesa-summary" },
                { label: "Pago", targetId: "compra-mesa-payment" },
              ]}
            />

            <div id="compra-mesa-summary" className="scroll-mt-24 space-y-3">
              <LegalSummaryNotice />
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 text-sm text-white/80">
                <div className="flex items-center justify-between text-white">
                  <span className="font-semibold">Mesa</span>
                  <span className="font-semibold">
                    {tableInfo?.name || "Por definir"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white">
                  <span>Documento</span>
                  <span className="font-semibold text-white">
                    {form.document || "—"} ({form.doc_type})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pack seleccionado</span>
                  <span className="font-semibold text-white">
                    {selectedProductInfo?.name || "Sin pack"}
                  </span>
                </div>
                {totalLabel && (
                  <div className="flex items-center justify-between text-white">
                    <span className="text-white/80">Total a pagar</span>
                    <span className="text-lg font-semibold text-[#e91e63]">
                      {totalLabel}
                    </span>
                  </div>
                )}
                {selectedProductInfo?.items &&
                  selectedProductInfo.items.length > 0 && (
                    <div className="pt-2 text-xs text-white/60">
                      Incluye:
                      <ul className="mt-1 space-y-1">
                        {selectedProductInfo.items.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>

            <div id="compra-mesa-payment" className="scroll-mt-24">
              <PaymentMethodSelector
                value={selectedPaymentMethod}
                onChange={setSelectedPaymentMethod}
                culqiAvailable={canUseCulqiForMesa}
                amountLabel={totalLabel}
                compact
              />
            </div>
            {!isMesaCulqiSelected && (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                      Paga con Yape/Plin
                    </p>
                    <p className="text-2xl font-semibold leading-tight text-white">
                      {yapeNumber}
                    </p>
                    <p className="text-xs text-white/60">
                      Titular: {yapeHolder}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyYapeNumber}
                    className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold btn-smoke-outline transition"
                  >
                    {copyFeedback === "copied"
                      ? "Copiado"
                      : copyFeedback === "error"
                        ? "No se pudo copiar"
                        : "Copiar número"}
                    <span className="text-[#f2f2f2]/70">(para abrir Yape)</span>
                  </button>
                </div>
                {totalLabel && (
                  <div className="rounded-xl bg-[#e91e63]/10 p-3 text-sm text-white/80">
                    Envía{" "}
                    <span className="font-semibold text-white">
                      {totalLabel}
                    </span>{" "}
                    al número indicado y adjunta el comprobante abajo.
                  </div>
                )}
              </div>
            )}
            {!isMesaCulqiSelected && (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
                <label className="text-sm font-semibold text-white">
                  Comprobante de pago
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200 ${
                    isDragging
                      ? "border-[#e91e63] bg-[#e91e63]/10 scale-[1.02]"
                      : uploading || reservationDone
                        ? "border-white/10 bg-[#111111] cursor-not-allowed opacity-60"
                        : "border-white/20 bg-[#111111] hover:border-white/40 hover:bg-[#151515]"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={onFileChange}
                    disabled={uploading || reservationDone}
                    className="absolute inset-0 z-10 cursor-pointer opacity-0"
                    id="voucher-upload"
                  />
                  <label
                    htmlFor="voucher-upload"
                    className={`flex flex-col items-center justify-center gap-3 px-6 py-8 ${
                      uploading || reservationDone
                        ? "cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                  >
                    {uploading ? (
                      <>
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#e91e63]"></div>
                        <p className="text-sm font-semibold text-white">
                          Subiendo comprobante...
                        </p>
                      </>
                    ) : form.voucher_url ? (
                      <>
                        <svg
                          className="h-12 w-12 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <p className="text-sm font-semibold text-emerald-400">
                          Comprobante subido
                        </p>
                        <p className="text-xs text-white/60">
                          Haz clic o arrastra para reemplazar
                        </p>
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-12 w-12 text-white/40"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-white">
                            {isDragging
                              ? "Suelta la imagen aquí"
                              : "Arrastra tu comprobante o haz clic"}
                          </p>
                          <p className="mt-1 text-xs text-white/60">
                            JPG, PNG, WEBP • Máx 5MB
                          </p>
                        </div>
                      </>
                    )}
                  </label>
                </div>

                {form.voucher_url && (
                  <a
                    href={form.voucher_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    Ver comprobante subido
                  </a>
                )}
              </div>
            )}
            {/* end yape/voucher block */}
            {modalError && (
              <p className="text-xs font-semibold text-[#ff9a9a]">
                {modalError}
              </p>
            )}
            {reservationSubmitted ? (
              <div className="space-y-3 rounded-2xl border-2 border-emerald-400/70 bg-emerald-500/15 p-5 text-white shadow-[0_12px_40px_rgba(0,255,170,0.2)]">
                <p className="text-lg font-bold">Reserva enviada.</p>
                <p className="text-base text-white/80">
                  Validaremos el pago manualmente y te confirmaremos por correo
                  en los próximos minutos.
                </p>
                {successCodes && successCodes.length > 0 && (
                  <>
                    <div className="space-y-1">
                      {successCodes.map((c) => (
                        <div
                          key={c}
                          className="rounded-xl bg-black/30 px-3 py-2 font-mono text-xs"
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-white/70">
                      Comparte estos códigos con tu grupo para que generen sus
                      QR.
                    </p>
                  </>
                )}
              </div>
            ) : isMesaCulqiSelected ? (
              <div className="rounded-2xl border border-[#e91e63]/30 bg-[#e91e63]/10 p-4 text-base font-semibold text-white/80">
                Al confirmar, abriremos el pago online con tarjeta. Tu reserva
                se confirmará cuando el pago sea aprobado.
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-base font-semibold text-white/80">
                Validaremos el pago manualmente. Te confirmaremos por correo tu
                reserva en los próximos minutos.
              </div>
            )}
            <div className="sticky bottom-0 z-20 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-white/10 bg-[#050505]/95 p-4 backdrop-blur sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowSummary(false);
                }}
                className="rounded-full px-4 py-2 text-xs font-semibold btn-smoke-outline transition"
              >
                Volver al formulario
              </button>
              <button
                type="button"
                onClick={confirmReservation}
                disabled={loading || uploading || reservationSubmitted}
                className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-wide btn-attention-red transition disabled:opacity-60"
              >
                {loading
                  ? "Enviando..."
                  : reservationSubmitted
                    ? "Reserva enviada"
                    : isMesaCulqiSelected
                      ? "Continuar al pago"
                      : "Enviar reserva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTicketSummary && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:items-center">
          <div className="relative w-full max-w-2xl space-y-4 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                  Revisión
                </p>
                <h3 className="text-2xl font-semibold text-white">
                  Recuento y pago
                </h3>
                <p className="text-sm text-white/60">
                  Confirma tu pedido y elige cómo pagar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTicketSummary(false);
                }}
                className="rounded-full px-3 py-1 text-xs font-semibold btn-smoke-outline transition"
              >
                Editar datos
              </button>
            </div>

            <ModalJumpTabs
              tabs={[
                { label: "Resumen", targetId: "compra-ticket-summary" },
                { label: "Pago", targetId: "compra-ticket-payment" },
              ]}
            />

            <div id="compra-ticket-summary" className="scroll-mt-24 space-y-3">
              <LegalSummaryNotice />

              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 text-sm text-white/80">
                <div className="flex items-center justify-between text-white">
                  <span className="font-semibold">Documento</span>
                  <span className="font-semibold text-white">
                    {ticketForm.document || "—"} ({ticketForm.doc_type})
                  </span>
                </div>
                {ticketRequiresEvent && (
                  <div className="flex items-center justify-between">
                    <span>Evento</span>
                    <span className="font-semibold text-white">
                      {ticketSelectedEvent?.name || "—"}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Modalidad</span>
                  <span className="font-semibold text-white">
                    {ticketSaleLabel} • {ticketQuantity} QR
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Nombre</span>
                  <span className="font-semibold text-white">
                    {ticketFullName || "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-xs text-white/60">
                  <span>Email: {ticketForm.email || "—"}</span>
                  <span>Teléfono: {ticketForm.phone || "—"}</span>
                </div>
              </div>
            </div>

            <div id="compra-ticket-payment" className="scroll-mt-24">
              <PaymentMethodSelector
                value={selectedPaymentMethodTicket}
                onChange={setSelectedPaymentMethodTicket}
                culqiAvailable={canUseCulqiForTicket}
                amountLabel={ticketPrice > 0 ? `S/ ${ticketPrice}` : null}
                compact
              />
            </div>

            {!isTicketCulqiSelected && (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                      Paga con Yape/Plin
                    </p>
                    <p className="text-2xl font-semibold leading-tight text-white">
                      {yapeNumber}
                    </p>
                    <p className="text-xs text-white/60">
                      Titular: {yapeHolder}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyYapeNumberTicket}
                    className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold btn-smoke-outline transition"
                  >
                    {ticketCopyFeedback === "copied"
                      ? "Copiado"
                      : ticketCopyFeedback === "error"
                        ? "No se pudo copiar"
                        : "Copiar número"}
                    <span className="text-[#f2f2f2]/70">(para abrir Yape)</span>
                  </button>
                </div>
                <div className="rounded-xl bg-[#e91e63]/10 p-3 text-sm text-white/80">
                  Envía S/ {ticketPrice} al número indicado y adjunta el
                  comprobante abajo.
                </div>
              </div>
            )}

            {!isTicketCulqiSelected && (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
                <label className="text-sm font-semibold text-white">
                  Comprobante de pago
                </label>

                <div
                  onDragOver={handleTicketDragOver}
                  onDragLeave={handleTicketDragLeave}
                  onDrop={handleTicketDrop}
                  className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200 ${
                    ticketIsDragging
                      ? "border-[#e91e63] bg-[#e91e63]/10 scale-[1.02]"
                      : ticketUploading
                        ? "border-white/10 bg-[#111111] cursor-not-allowed opacity-60"
                        : "border-white/20 bg-[#111111] hover:border-white/40 hover:bg-[#151515]"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await handleTicketFileUpload(file);
                    }}
                    disabled={ticketUploading}
                    className="absolute inset-0 z-10 cursor-pointer opacity-0"
                    id="ticket-voucher-upload"
                  />
                  <label
                    htmlFor="ticket-voucher-upload"
                    className={`flex flex-col items-center justify-center gap-3 px-6 py-8 ${
                      ticketUploading ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    {ticketUploading ? (
                      <>
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#e91e63]"></div>
                        <p className="text-sm font-semibold text-white">
                          Subiendo comprobante...
                        </p>
                      </>
                    ) : ticketVoucherUrl ? (
                      <>
                        <svg
                          className="h-12 w-12 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <p className="text-sm font-semibold text-emerald-400">
                          Comprobante subido
                        </p>
                        <p className="text-xs text-white/60">
                          Haz clic o arrastra para reemplazar
                        </p>
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-12 w-12 text-white/40"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-white">
                            {ticketIsDragging
                              ? "Suelta la imagen aquí"
                              : "Arrastra tu comprobante o haz clic"}
                          </p>
                          <p className="mt-1 text-xs text-white/60">
                            JPG, PNG, WEBP • Máx 5MB
                          </p>
                        </div>
                      </>
                    )}
                  </label>
                </div>

                {ticketVoucherUrl && (
                  <a
                    href={ticketVoucherUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#e91e63] underline-offset-4 hover:underline"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    Ver comprobante subido
                  </a>
                )}
              </div>
            )}

            {ticketModalError && (
              <p className="text-xs font-semibold text-[#ff9a9a]">
                {ticketModalError}
              </p>
            )}

            {!isTicketCulqiSelected && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
                Recibimos tu solicitud de compra. El equipo BABY validará el
                pago y te enviaremos la confirmación a tu bandeja de correo.
              </div>
            )}
            {isTicketCulqiSelected && (
              <div className="rounded-2xl border border-[#e91e63]/30 bg-[#e91e63]/10 p-3 text-xs font-semibold text-white/80">
                Al confirmar, abriremos el pago online con tarjeta. Tu entrada
                se confirmará cuando el pago sea aprobado.
              </div>
            )}

            <div className="sticky bottom-0 z-20 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-white/10 bg-[#050505]/95 p-4 backdrop-blur sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowTicketSummary(false);
                }}
                className="rounded-full px-4 py-2 text-xs font-semibold btn-smoke-outline transition"
              >
                Volver al formulario
              </button>
              <button
                type="button"
                onClick={confirmTicketPurchase}
                disabled={ticketLoading}
                className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-wide btn-smoke transition disabled:opacity-60"
              >
                {ticketLoading
                  ? "Enviando..."
                  : isTicketCulqiSelected
                    ? "Continuar al pago"
                    : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTicketConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-lg space-y-5 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500/80">
                ✓ Solicitud recibida
              </p>
              <h3 className="text-2xl font-semibold">
                Revisaremos tu solicitud de compra
              </h3>
              <p className="text-sm text-white/70">
                El equipo BABY validará tu comprobante y te confirmaremos por
                correo en tu bandeja con tu entrada y QR.
              </p>
            </div>

            {ticketReservationId && (
              <div className="rounded-2xl border border-[#e91e63]/30 bg-[#e91e63]/10 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  Código de reserva
                </p>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-black/40 px-4 py-3">
                  <span className="font-mono text-lg font-bold text-white tracking-wider">
                    {ticketReservationId}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(ticketReservationId);
                    }}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 transition"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-white/60">
                  Guarda este código para consultar el estado de tu solicitud.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowTicketConfirmation(false);
                  clearTicketInputs();
                }}
                className="rounded-full px-5 py-2.5 text-sm font-semibold btn-smoke transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {showReservationConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-lg space-y-5 rounded-3xl border border-white/15 bg-gradient-to-b from-[#111111] to-[#050505] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500/80">
                ✓ Reserva recibida
              </p>
              <h3 className="text-2xl font-semibold">
                Validaremos tu reserva de mesa
              </h3>
              <p className="text-sm text-white/70">
                Revisaremos tu comprobante y te confirmaremos por correo con el
                estado de la reserva y los códigos.
              </p>
            </div>

            {mesaReservationId && (
              <div className="rounded-2xl border border-[#e91e63]/30 bg-[#e91e63]/10 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  Código de reserva
                </p>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-black/40 px-4 py-3">
                  <span className="font-mono text-lg font-bold text-white tracking-wider">
                    {mesaReservationId}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(mesaReservationId);
                    }}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 transition"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-white/60">
                  Guarda este código para consultar el estado de tu reserva.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowReservationConfirmation(false);
                  clearMesaInputs();
                }}
                className="rounded-full px-5 py-2.5 text-sm font-semibold btn-smoke transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      {culqiOrderId && culqiPaymentId && culqiEnabled && (
        <CulqiCheckout
          publicKey={culqiPublicKey}
          orderId={culqiOrderId}
          paymentId={culqiPaymentId}
          onSuccess={() => {
            setCulqiOrderId(null);
            setCulqiPaymentId(null);
            if (culqiFlowType === "mesa") {
              setShowReservationConfirmation(true);
            } else {
              setShowTicketConfirmation(true);
            }
            setCulqiFlowType(null);
          }}
          onClose={() => {
            setCulqiOrderId(null);
            setCulqiPaymentId(null);
            setCulqiFlowType(null);
          }}
        />
      )}
    </main>
  );
}

function LegalComplianceStrip() {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-xs text-white/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-semibold text-white">
          Compra segura y validada por BABY
        </span>
        <span>Entradas digitales y reservas de mesa BABY</span>
        {legalLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-semibold text-[#ff77ad] underline-offset-4 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function LegalAcceptance({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-white/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[#e91e63]"
      />
      <span>
        Acepto los{" "}
        <Link
          href="/terminos-condiciones"
          className="font-semibold text-[#ff77ad] underline-offset-4 hover:underline"
        >
          Términos y condiciones
        </Link>
        , la{" "}
        <Link
          href="/politica-privacidad"
          className="font-semibold text-[#ff77ad] underline-offset-4 hover:underline"
        >
          Política de privacidad
        </Link>{" "}
        y la{" "}
        <Link
          href="/politica-cambios-devoluciones"
          className="font-semibold text-[#ff77ad] underline-offset-4 hover:underline"
        >
          Política de cambios y devoluciones
        </Link>
        . El{" "}
        <Link
          href="/libro-reclamaciones"
          className="font-semibold text-[#ff77ad] underline-offset-4 hover:underline"
        >
          Libro de Reclamaciones
        </Link>{" "}
        está disponible antes y después de la compra.
      </span>
    </label>
  );
}

function LegalSummaryNotice() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-white/65">
      Al continuar, confirmas que revisaste y aceptaste los términos,
      privacidad, condiciones de acceso y política de cambios/devoluciones de
      BABY.
    </div>
  );
}

function ModalJumpTabs({
  tabs,
}: {
  tabs: Array<{ label: string; targetId: string }>;
}) {
  const scrollToSection = (targetId: string) => {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="sticky top-0 z-20 -mx-1 rounded-2xl border border-white/10 bg-[#070707]/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur">
      <div className="grid grid-cols-2 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.targetId}
            type="button"
            onClick={() => scrollToSection(tab.targetId)}
            className="min-h-10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e91e63]"
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaymentMethodSelector({
  title = "Método de pago",
  value,
  onChange,
  culqiAvailable,
  amountLabel,
  compact = false,
}: {
  title?: string;
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  culqiAvailable: boolean;
  amountLabel?: string | null;
  compact?: boolean;
}) {
  const cardBase = `flex ${
    compact ? "min-h-[64px]" : "min-h-[92px]"
  } items-start gap-3 rounded-2xl border p-3 text-left transition`;
  const activeClass =
    "border-[#e91e63]/70 bg-[#e91e63]/15 text-white shadow-[0_12px_36px_rgba(233,30,99,0.18)]";
  const idleClass = "border-white/10 bg-[#0b0b0b] text-white hover:bg-white/5";
  const disabledClass =
    "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/45";

  return (
    <section className="space-y-2 rounded-2xl border border-white/10 bg-[#0a0a0a] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        {amountLabel ? (
          <span className="rounded-full border border-[#e91e63]/30 bg-[#e91e63]/10 px-3 py-1 text-xs font-semibold text-[#ff77ad]">
            Total {amountLabel}
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          aria-pressed={value === "yape"}
          onClick={() => onChange("yape")}
          className={`${cardBase} ${value === "yape" ? activeClass : idleClass}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
            <Smartphone className="h-4 w-4" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="block text-sm font-semibold">Yape / Plin</span>
            {!compact ? (
              <span className="block text-xs font-medium text-white/60">
                Transferencia y validación manual con comprobante.
              </span>
            ) : null}
          </span>
        </button>

        <button
          type="button"
          aria-pressed={value === "culqi"}
          onClick={() => {
            if (culqiAvailable) onChange("culqi");
          }}
          disabled={!culqiAvailable}
          className={`${cardBase} ${
            !culqiAvailable
              ? disabledClass
              : value === "culqi"
                ? activeClass
                : idleClass
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
            <CreditCard className="h-4 w-4" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="block text-sm font-semibold">Tarjeta</span>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/45">
              DISPONIBLE PRONTO
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  className = "",
  inputMode,
  maxLength,
  digitOnly = false,
  error,
  allowClear = false,
  onClear,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  digitOnly?: boolean;
  error?: string;
  allowClear?: boolean;
  onClear?: () => void;
  onBlur?: () => void;
}) {
  const showClear = allowClear && value.length > 0;
  return (
    <label
      className={`block space-y-2 text-sm font-semibold text-white ${className}`}
    >
      {label}
      <div className="relative">
        <input
          value={value}
          onChange={(e) => {
            let next = e.target.value;
            if (digitOnly) {
              next = next.replace(/\D/g, "");
              if (maxLength) next = next.slice(0, maxLength);
            }
            onChange(next);
          }}
          placeholder={placeholder}
          type={type}
          required={required}
          onBlur={onBlur}
          inputMode={inputMode}
          maxLength={maxLength}
          className={`w-full rounded-xl border bg-[#111111] px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-none ${
            error ? "border-[#ff9a9a]" : "border-white/10"
          } ${showClear ? "pr-11" : ""}`}
        />
        {showClear && (
          <button
            type="button"
            onClick={() => {
              if (onClear) onClear();
              else onChange("");
            }}
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xs text-white hover:bg-white/20"
            aria-label={`Borrar ${label}`}
          >
            ×
          </button>
        )}
      </div>
      {error && <p className="text-xs font-semibold text-[#ff9a9a]">{error}</p>}
    </label>
  );
}
