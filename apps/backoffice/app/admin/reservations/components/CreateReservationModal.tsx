"use client";

import { useState, useEffect, useRef } from "react";
import { X, Calendar, User, Mail, Phone, CreditCard, FileText, QrCode, AlertCircle, CheckCircle, Loader2, Search, Users, Tag, Upload, File, Trash2 } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";

type Mode = "new_customer" | "existing_ticket";
type Status = "pending" | "approved" | "confirmed";

interface Event {
  id: string;
  name: string;
  date: string;
  organizer_name?: string;
}

interface Table {
  id: string;
  name: string;
  event_id: string;
  ticket_count: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  table_id: string;
}

interface Ticket {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  doc_type: string;
}

interface CreateReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizers: { id: string; name: string }[];
}

export default function CreateReservationModal({ isOpen, onClose, onSuccess, organizers }: CreateReservationModalProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>("new_customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Datos del formulario
  const [selectedOrganizer, setSelectedOrganizer] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");

  // Cliente nuevo
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [docType, setDocType] = useState<"dni" | "ce" | "passport">("dni");
  const [document, setDocument] = useState("");
  const [searchingDocument, setSearchingDocument] = useState(false);

  // Cliente existente
  const [ticketSearch, setTicketSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Configuración
  const [status, setStatus] = useState<Status>("approved");
  const [voucherUrl, setVoucherUrl] = useState("");
  const [notes, setNotes] = useState("");
  // TODO: Izipay integration - payment gateway will be integrated here
  // const [paymentMethod, setPaymentMethod] = useState<'voucher' | 'izipay'>('voucher');
  
  // Upload states
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedOrganizer) {
      loadEvents();
    }
  }, [selectedOrganizer]);

  useEffect(() => {
    if (selectedEvent) {
      loadTables();
    }
  }, [selectedEvent]);

  // Debug: Monitorear cambios en los campos del formulario
  useEffect(() => {
    console.log('🔄 Form fields changed:', { fullName, email, phone });
  }, [fullName, email, phone]);

  useEffect(() => {
    if (selectedTable) {
      loadProducts();
    }
  }, [selectedTable]);

  const resetForm = () => {
    setStep(1);
    setMode("new_customer");
    setError(null);
    setSuccess(false);
    setSelectedOrganizer("");
    setSelectedEvent("");
    setSelectedTable("");
    setSelectedProduct("");
    setFullName("");
    setEmail("");
    setPhone("");
    setDocument("");
    setDocType("dni");
    setTicketSearch("");
    setSearchResults([]);
    setSelectedTicket(null);
    setStatus("approved");
    setVoucherUrl("");
    setNotes("");
    setVoucherFile(null);
    setUploadingVoucher(false);
    setIsDragging(false);
  };

  const loadEvents = async () => {
    try {
      const response = await authedFetch(`/api/admin/events?organizer_id=${selectedOrganizer}`);
      const data = await response.json();
      if (data.success && data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error("Error loading events:", err);
    }
  };

  const loadTables = async () => {
    try {
      const response = await authedFetch(`/api/admin/tables?event_id=${selectedEvent}`);
      const data = await response.json();
      if (data.success && data.tables) {
        setTables(data.tables.filter((t: Table) => t.event_id === selectedEvent));
      }
    } catch (err) {
      console.error("Error loading tables:", err);
    }
  };

  const loadProducts = async () => {
    // TODO: Productos opcionales de mesa - endpoint pendiente
    // Por ahora no carga productos para evitar error 404
    /*
    try {
      const response = await authedFetch(`/api/admin/table-products?table_id=${selectedTable}`);
      const data = await response.json();
      if (data.success && data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    }
    */
  };

  const searchTickets = async () => {
    if (!ticketSearch.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await authedFetch(`/api/admin/tickets/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: ticketSearch })
      });
      
      if (!response.ok) {
        throw new Error('Error al buscar tickets');
      }
      const data = await response.json();
      if (data.success && data.ticket) {
        setSearchResults([data.ticket]);
      } else {
        setSearchResults([]);
        setError('No se encontraron tickets con ese criterio');
      }
    } catch (err: any) {
      console.error("Error searching tickets:", err);
      setError(err.message || 'Error al buscar tickets');
    } finally {
      setLoading(false);
    }
  };

  const searchByDocument = async (doc: string, type: string) => {
    if (!doc.trim() || (type === 'dni' && doc.length < 8)) {
      console.log('Skipping search - invalid document:', { doc, type, length: doc.length });
      return;
    }
    
    console.log('🔍 Starting document search:', { doc, type });
    setSearchingDocument(true);
    setError(null);
    
    try {
      // Buscar en tabla persons de Supabase
      console.log('→ Calling /api/persons/search?dni=' + doc);
      const personsResponse = await authedFetch(`/api/persons/search?dni=${encodeURIComponent(doc)}`);
      
      console.log('← Response status:', personsResponse.status);
      
      if (personsResponse.ok) {
        const personsData = await personsResponse.json();
        console.log('✅ Persons search response:', personsData);
        
        if (personsData.success && personsData.person) {
          const person = personsData.person;
          console.log('👤 Found person:', person);
          
          // Autocompletar con datos de persons
          const fullNameFromPerson = `${person.first_name || ''} ${person.last_name || ''}`.trim();
          const emailFromPerson = person.email || '';
          const phoneFromPerson = person.phone || '';
          
          console.log('📝 About to set values:', { 
            fullName: fullNameFromPerson,
            email: emailFromPerson,
            phone: phoneFromPerson
          });
          
          // Forzar actualización usando setTimeout para asegurar que React procese
          setTimeout(() => {
            console.log('🔄 Executing setState calls...');
            
            if (fullNameFromPerson) {
              setFullName(fullNameFromPerson);
              console.log('✓ fullName set to:', fullNameFromPerson);
            }
            if (emailFromPerson) {
              setEmail(emailFromPerson);
              console.log('✓ email set to:', emailFromPerson);
            }
            if (phoneFromPerson) {
              setPhone(phoneFromPerson);
              console.log('✓ phone set to:', phoneFromPerson);
            }
            
            console.log('✓ All values updated');
          }, 0);
          
          setSearchingDocument(false);
          console.log('✓ Person data loaded successfully');
          return; // Encontramos datos, no seguir buscando
        } else {
          console.log('⚠️ No person found in response');
        }
      } else {
        console.log('❌ Persons API returned error status:', personsResponse.status);
      }

      // Si no encuentra en BD y es DNI peruano de 8 dígitos, consultar API Reniec
      console.log('→ Trying Reniec API');
      if (type === 'dni' && doc.length === 8) {
        const reniecResponse = await authedFetch(`/api/reniec/dni/${doc}`);
        
        if (reniecResponse.ok) {
          const reniecData = await reniecResponse.json();
          console.log('Reniec API response:', reniecData);
          
          if (reniecData.success && reniecData.data) {
            const nombres = reniecData.data.nombres || "";
            const apellidoPaterno = reniecData.data.apellidoPaterno || "";
            const apellidoMaterno = reniecData.data.apellidoMaterno || "";
            const fullNameFromReniec = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim();
            
            if (fullNameFromReniec) {
              setFullName(fullNameFromReniec);
              console.log('✓ Reniec data loaded:', fullNameFromReniec);
            }
          }
        }
      }
      
      console.log('⚠️ No data found in any source');
    } catch (err: any) {
      console.error("❌ Error searching document:", err);
    } finally {
      setSearchingDocument(false);
      console.log('🏁 Search completed');
    }
  };

  const selectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setFullName(ticket.full_name);
    setEmail(ticket.email || "");
    setPhone(ticket.phone || "");
    setDocument(ticket.document || "");
    setDocType(ticket.doc_type as any || "dni");
    setSearchResults([]);
    setTicketSearch("");
  };

  const validateStep1 = () => {
    if (mode === "existing_ticket") {
      return selectedTicket !== null;
    }
    return fullName.trim().length > 0 && email.trim().length > 0;
  };

  const validateStep2 = () => {
    return selectedOrganizer && selectedEvent && selectedTable;
  };

  // Obtener cantidad de entradas según la mesa seleccionada
  const getTicketCount = () => {
    const table = tables.find(t => t.id === selectedTable);
    return table?.ticket_count || 0;
  };

  // Upload voucher to Supabase Storage
  const uploadVoucher = async (file: File) => {
    if (!file) return null;
    
    setUploadingVoucher(true);
    setError(null);
    
    try {
      // Usar endpoint del servidor para subir el archivo
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'vouchers');

      const response = await authedFetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al subir archivo' }));
        setError(errorData.error || 'Error al subir el voucher');
        return null;
      }

      const data = await response.json();
      
      if (data.success && data.url) {
        setVoucherUrl(data.url);
        return data.url;
      } else {
        setError('No se pudo obtener la URL del voucher');
        return null;
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('Error al subir el voucher');
      return null;
    } finally {
      setUploadingVoucher(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Formato no válido. Solo se permiten imágenes (JPG, PNG, WEBP) o PDF');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo es muy grande. Máximo 5MB');
      return;
    }

    setVoucherFile(file);
    await uploadVoucher(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileSelect(file);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileSelect(file);
    }
  };

  const removeVoucher = () => {
    setVoucherFile(null);
    setVoucherUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        mode,
        table_id: selectedTable,
        event_id: selectedEvent,
        status,
        notes,
        voucher_url: voucherUrl,
        // TODO: Izipay - add payment_method and transaction_id when integrated
        // payment_method: paymentMethod,
        // izipay_transaction_id: transactionId,
      };

      if (selectedProduct) {
        payload.product_id = selectedProduct;
      }

      if (mode === "new_customer") {
        payload.full_name = fullName;
        payload.email = email;
        payload.phone = phone;
        payload.doc_type = docType;
        payload.document = document;
      } else {
        payload.ticket_id = selectedTicket?.id;
        payload.email = email;
        payload.phone = phone;
      }

      const response = await authedFetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al crear la reserva");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-600 to-neutral-700 px-6 py-4 flex items-center justify-between border-b border-neutral-500/50">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nueva Reserva Manual</h2>
              <p className="text-sm text-neutral-100">Paso {step} de 3</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-white/10"
          >
            <X className="h-5 w-5 text-white" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="bg-neutral-800 px-6 py-3 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`h-2 rounded-full flex-1 transition-all ${
                    s <= step ? "bg-neutral-500" : "bg-neutral-700"
                  }`}
                />
                {s < 3 && <div className="w-2" />}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className={step >= 1 ? "text-neutral-400 font-medium" : "text-neutral-500"}>
              Cliente
            </span>
            <span className={step >= 2 ? "text-neutral-400 font-medium" : "text-neutral-500"}>
              Mesa & Evento
            </span>
            <span className={step >= 3 ? "text-neutral-400 font-medium" : "text-neutral-500"}>
              Confirmación
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-700 text-red-200 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-900/30 border border-green-700 text-green-200 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">¡Reserva creada exitosamente!</p>
                <p className="text-sm">Redirigiendo...</p>
              </div>
            </div>
          )}

          {/* Step 1: Cliente */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-neutral-300 mb-3">
                  Tipo de Reserva
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    onClick={() => setMode("new_customer")}
                    variant="outline"
                    className={`p-4 rounded-lg border-2 transition-all ${
                      mode === "new_customer"
                        ? "border-neutral-500 bg-neutral-500/20 text-neutral-300"
                        : "border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    <User className="h-6 w-6 mx-auto mb-2" />
                    <p className="font-semibold text-sm">Cliente Nuevo</p>
                    <p className="text-xs opacity-75 mt-1">Sin ticket previo</p>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setMode("existing_ticket")}
                    variant="outline"
                    className={`p-4 rounded-lg border-2 transition-all ${
                      mode === "existing_ticket"
                        ? "border-neutral-500 bg-neutral-500/20 text-neutral-300"
                        : "border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    <QrCode className="h-6 w-6 mx-auto mb-2" />
                    <p className="font-semibold text-sm">Con Ticket</p>
                    <p className="text-xs opacity-75 mt-1">Buscar existente</p>
                  </Button>
                </div>
              </div>

              {mode === "existing_ticket" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      Buscar Ticket
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          type="text"
                          value={ticketSearch}
                          onChange={(e) => setTicketSearch(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && searchTickets()}
                          placeholder="Email, teléfono o documento..."
                          className="h-10 border-neutral-700 bg-neutral-800 pl-10 text-neutral-200 placeholder:text-neutral-500 focus:ring-2 focus:ring-neutral-500"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={searchTickets}
                        disabled={loading || !ticketSearch.trim()}
                        className="bg-neutral-600 text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Buscar
                      </Button>
                    </div>
                  </div>

                  {selectedTicket && (
                    <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-green-400 font-semibold flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Ticket Seleccionado
                          </p>
                          <p className="text-white mt-1">{selectedTicket.full_name}</p>
                          <p className="text-neutral-400 text-sm">{selectedTicket.email}</p>
                        </div>
                        <Button
                          onClick={() => setSelectedTicket(null)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="border border-neutral-700 rounded-lg overflow-hidden">
                      <div className="bg-neutral-800 px-4 py-2 border-b border-neutral-700">
                        <p className="text-sm font-semibold text-neutral-300">
                          {searchResults.length} resultados encontrados
                        </p>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {searchResults.map((ticket) => (
                          <Button
                            key={ticket.id}
                            onClick={() => selectTicket(ticket)}
                            variant="ghost"
                            className="h-auto w-full justify-start rounded-none border-b border-neutral-700/50 px-4 py-3 text-left hover:bg-neutral-800/50 last:border-b-0"
                          >
                            <p className="font-medium text-neutral-200">{ticket.full_name}</p>
                            <p className="text-sm text-neutral-400">{ticket.email || ticket.phone}</p>
                            {ticket.document && (
                              <p className="text-xs text-neutral-500 mt-1">
                                {ticket.doc_type?.toUpperCase()}: {ticket.document}
                              </p>
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Prioridad: DNI primero para búsqueda automática */}
                  <div className="bg-neutral-900/20 border border-neutral-700/50 rounded-lg p-3">
                    <p className="text-xs text-neutral-300 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />
                      Ingresa el DNI para autocompletar los datos desde nuestra BD o Reniec
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Tipo Documento *
                      </label>
                      <SelectNative
                        value={docType}
                        onChange={(e) => {
                          setDocType(e.target.value as any);
                          if (document) {
                            searchByDocument(document, e.target.value);
                          }
                        }}
                        className="h-10 border-neutral-700 bg-neutral-800 text-neutral-200 focus:ring-2 focus:ring-neutral-500"
                      >
                        <option value="dni">DNI</option>
                        <option value="ce">CE</option>
                        <option value="passport">Pasaporte</option>
                      </SelectNative>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Número Documento *
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                          <Input
                            type="text"
                            value={document}
                            onChange={(e) => setDocument(e.target.value)}
                            placeholder={docType === 'dni' ? '12345678' : 'Número'}
                            maxLength={docType === 'dni' ? 8 : 20}
                            className="h-10 border-neutral-700 bg-neutral-800 pl-10 text-neutral-200 placeholder:text-neutral-500 focus:ring-2 focus:ring-neutral-500"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => searchByDocument(document, docType)}
                          disabled={searchingDocument || !document.trim()}
                          className="bg-neutral-600 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-700"
                          title="Buscar datos del cliente"
                        >
                          {searchingDocument ? (
                            <Loader2 className="h-4 w-4 text-white animate-spin" />
                          ) : (
                            <Search className="h-4 w-4 text-white" />
                          )}
                        </Button>
                      </div>
                      {searchingDocument && (
                        <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Buscando datos...
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Nombre Completo *
                      </label>
                      <Input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Se autocompletará con el DNI"
                        className="h-10 border-neutral-700 bg-neutral-800 text-neutral-200 placeholder:text-neutral-500 focus:ring-2 focus:ring-neutral-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Email *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="juan@example.com"
                          className="h-10 border-neutral-700 bg-neutral-800 pl-10 text-neutral-200 placeholder:text-neutral-500 focus:ring-2 focus:ring-neutral-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Teléfono
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="987654321"
                          className="h-10 border-neutral-700 bg-neutral-800 pl-10 text-neutral-200 placeholder:text-neutral-500 focus:ring-2 focus:ring-neutral-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Mesa & Evento */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Organizador *
                </label>
                <SelectNative
                  value={selectedOrganizer}
                  onChange={(e) => {
                    setSelectedOrganizer(e.target.value);
                    setSelectedEvent("");
                    setSelectedTable("");
                  }}
                  className="h-10 border-neutral-700 bg-neutral-800 text-neutral-200 focus:ring-2 focus:ring-neutral-500"
                >
                  <option value="">Seleccionar organizador</option>
                  {organizers.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </SelectNative>
              </div>

              {selectedOrganizer && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Evento *
                  </label>
                  <SelectNative
                    value={selectedEvent}
                    onChange={(e) => {
                      setSelectedEvent(e.target.value);
                      setSelectedTable("");
                    }}
                    className="h-10 border-neutral-700 bg-neutral-800 text-neutral-200 focus:ring-2 focus:ring-neutral-500"
                  >
                    <option value="">Seleccionar evento</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name} - {event.date}
                      </option>
                    ))}
                  </SelectNative>
                </div>
              )}

              {selectedEvent && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Mesa *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {tables.map((table) => (
                      <Button
                        key={table.id}
                        type="button"
                        onClick={() => setSelectedTable(table.id)}
                        variant="outline"
                        className={`p-4 rounded-lg border-2 transition-all ${
                          selectedTable === table.id
                            ? "border-neutral-500 bg-neutral-500/20 text-neutral-300"
                            : "border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600"
                        }`}
                      >
                        <Users className="h-5 w-5 mx-auto mb-1" />
                        <p className="font-semibold text-sm">{table.name}</p>
                        <p className="text-xs opacity-75">{table.ticket_count} personas</p>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTable && products.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Producto/Combo (Opcional)
                  </label>
                  <SelectNative
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="h-10 border-neutral-700 bg-neutral-800 text-neutral-200 focus:ring-2 focus:ring-neutral-500"
                  >
                    <option value="">Sin producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - S/ {product.price}
                      </option>
                    ))}
                  </SelectNative>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirmación */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-200 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  Resumen de Reserva
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Cliente:</span>
                    <span className="text-neutral-200 font-medium">{fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Email:</span>
                    <span className="text-neutral-200">{email}</span>
                  </div>
                  {phone && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Teléfono:</span>
                      <span className="text-neutral-200">{phone}</span>
                    </div>
                  )}
                  <div className="border-t border-neutral-700 my-2" />
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Mesa:</span>
                    <span className="text-neutral-200 font-medium">
                      {tables.find((t) => t.id === selectedTable)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Evento:</span>
                    <span className="text-neutral-200">
                      {events.find((e) => e.id === selectedEvent)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Entradas incluidas:</span>
                    <span className="font-semibold text-green-400">
                      {getTicketCount()} tickets
                    </span>
                  </div>
                  {selectedProduct && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Producto:</span>
                      <span className="text-neutral-200">
                        {products.find((p) => p.id === selectedProduct)?.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Estado
                </label>
                <SelectNative
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="h-10 border-neutral-700 bg-neutral-800 text-neutral-200 focus:ring-2 focus:ring-neutral-500"
                >
                  <option value="pending">🟡 Pendiente</option>
                  <option value="approved">✅ Aprobada</option>
                  <option value="confirmed">🎉 Confirmada</option>
                </SelectNative>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Voucher de Pago (Opcional)
                </label>
                
                {!voucherUrl ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-neutral-500 bg-neutral-500/10"
                        : "border-neutral-600 bg-neutral-800/50 hover:border-neutral-500 hover:bg-neutral-800"
                    }`}
                  >
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    
                    {uploadingVoucher ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 text-neutral-400 animate-spin" />
                        <p className="text-sm text-neutral-400">Subiendo voucher...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-neutral-400" />
                        <p className="text-sm text-neutral-300">
                          Arrastra el voucher aquí o <span className="text-neutral-400">haz click para seleccionar</span>
                        </p>
                        <p className="text-xs text-neutral-500">
                          JPG, PNG, WEBP o PDF (máx. 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-neutral-700 rounded-lg p-4 bg-neutral-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded">
                          <File className="h-5 w-5 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-200">
                            {voucherFile?.name || 'Voucher cargado'}
                          </p>
                          <a
                            href={voucherUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-neutral-400 hover:underline"
                          >
                            Ver archivo
                          </a>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={removeVoucher}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-neutral-500 mt-1">
                  📌 Próximamente: Integración con Izipay para pagos directos
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Notas Internas (Opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Información adicional sobre la reserva..."
                  rows={3}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                />
              </div>

              <div className="bg-neutral-900/20 border border-neutral-700/30 rounded-lg p-3">
                <p className="text-xs text-neutral-300">
                  ℹ️ Al crear la reserva, se enviará un correo transaccional al cliente con los detalles de su reserva
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-neutral-800 px-6 py-4 border-t border-neutral-700 flex items-center justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                onClick={() => setStep(step - 1)}
                disabled={loading}
                variant="outline"
                className="border-neutral-600 text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Atrás
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onClose}
              disabled={loading}
              variant="outline"
              className="border-neutral-600 text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </Button>

            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  loading ||
                  (step === 1 && !validateStep1()) ||
                  (step === 2 && !validateStep2())
                }
                className="bg-neutral-600 text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || success}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold hover:from-green-500 hover:to-green-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Crear Reserva
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
