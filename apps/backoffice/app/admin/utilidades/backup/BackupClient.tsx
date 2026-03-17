"use client";

import { useState } from "react";
import { Database, Download, Mail, Shield, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authedFetch } from "@/lib/authedFetch";

type BackupStatus = "idle" | "loading" | "success" | "error";

export default function BackupClient() {
  const [status, setStatus] = useState<BackupStatus>("idle");
  const [emailStatus, setEmailStatus] = useState<BackupStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [lastBackupInfo, setLastBackupInfo] = useState<{ size: string; tables: number; rows: number } | null>(null);

  const handleDownload = async () => {
    setStatus("loading");
    setError(null);
    setLastBackupInfo(null);

    try {
      const res = await authedFetch("/api/admin/utilidades/backup");
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Error al generar el backup");
      }

      const blob = await res.blob();
      const sizeKB = (blob.size / 1024).toFixed(1);
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      const sizeLabel = blob.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

      const url = URL.createObjectURL(blob);
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `backup_babyclub_${timestamp}.sql`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      // Read metadata from header
      const tablesHeader = res.headers.get("X-Backup-Tables") || "?";
      const rowsHeader = res.headers.get("X-Backup-Rows") || "?";

      setLastBackupInfo({ size: sizeLabel, tables: Number(tablesHeader), rows: Number(rowsHeader) });
      setStatus("success");
    } catch (err: any) {
      setError(err?.message || "Error inesperado");
      setStatus("error");
    }
  };

  const handleSendEmail = async () => {
    if (!email.trim()) return;
    setEmailStatus("loading");
    setEmailError(null);
    setEmailSuccess(null);

    try {
      const res = await authedFetch(`/api/admin/utilidades/backup?email=${encodeURIComponent(email.trim())}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Error al enviar el backup por email");
      }
      setEmailSuccess(`Backup enviado a ${email.trim()}`);
      setEmailStatus("success");
    } catch (err: any) {
      setEmailError(err?.message || "Error inesperado");
      setEmailStatus("error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Advertencia de seguridad */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-300">Datos sensibles</p>
            <p className="text-xs text-amber-200/70">
              El backup contiene datos personales (DNI, email, teléfono). El archivo .sql
              es restaurable directamente en Supabase. Manéjalo con cuidado y compártelo
              solo con personal autorizado.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Panel principal de backup */}
      <Card className="border-[#252525] bg-[#111111]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-rose-400" />
            Exportar base de datos
          </CardTitle>
          <CardDescription className="text-xs text-white/55">
            Genera un archivo <span className="font-mono text-white/70">.sql</span> restaurable
            directamente en Supabase o con <span className="font-mono text-white/70">psql</span>.
            Incluye INSERT statements ordenados por dependencias FK. Máximo 50,000 filas por tabla.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info de tablas incluidas */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Tablas incluidas</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "organizers", "events", "tickets", "codes", "code_batches",
                "promoters", "persons", "staff", "tables", "table_reservations",
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/60"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Resultado del último backup */}
          {status === "success" && lastBackupInfo && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-300 space-y-0.5">
                <p className="font-semibold">Backup generado y descargado</p>
                <p className="text-emerald-300/70">
                  {lastBackupInfo.tables} tablas · {lastBackupInfo.rows.toLocaleString("es-PE")} filas · {lastBackupInfo.size}
                </p>
              </div>
            </div>
          )}

          {status === "error" && error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Botón de descarga */}
          <Button
            type="button"
            onClick={handleDownload}
            disabled={status === "loading"}
            className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-400 hover:to-pink-500 disabled:opacity-60"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando backup...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Descargar backup SQL
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Enviar por email */}
      <Card className="border-[#252525]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-blue-400" />
            Enviar backup por email
          </CardTitle>
          <CardDescription className="text-xs text-white/55">
            Se generará el backup y se enviará como adjunto al correo indicado.
            Tamaño máximo de adjunto: 40 MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ejemplo.com"
              className="flex-1 h-10 border-white/10 bg-black/30 text-white placeholder:text-white/30 focus:border-rose-500/50"
            />
            <Button
              type="button"
              onClick={handleSendEmail}
              disabled={emailStatus === "loading" || !email.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 shrink-0"
            >
              {emailStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {emailStatus === "loading" ? "Enviando..." : "Enviar"}
            </Button>
          </div>

          {emailSuccess && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {emailSuccess}
            </div>
          )}
          {emailError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {emailError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer de seguridad */}
      <div className="flex items-center gap-2 text-xs text-white/30 px-1">
        <Shield className="h-3.5 w-3.5 shrink-0" />
        <span>Acceso restringido a administradores. Todas las acciones quedan registradas.</span>
      </div>
    </div>
  );
}
