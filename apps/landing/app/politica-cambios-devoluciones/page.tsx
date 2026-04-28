import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../legal/LegalPage";
import { getLegalConfig } from "lib/legal";

export const metadata: Metadata = {
  title: "Cambios y devoluciones",
  description: "Política de cambios y devoluciones de Baby Club.",
};

export default function RefundPolicyPage() {
  const legal = getLegalConfig();

  return (
    <LegalPage
      eyebrow="Compras"
      title="Política de cambios y devoluciones"
      description="Reglas aplicables a entradas digitales y reservas de mesa compradas desde la landing de Baby Club."
    >
      <LegalSection title="Alcance">
        <p>
          Esta política aplica a entradas digitales y reservas de mesa para
          eventos organizados por {legal.tradeName}. Por la naturaleza del
          servicio, cada compra está vinculada a un evento, fecha y aforo
          específico.
        </p>
      </LegalSection>

      <LegalSection title="Regla general">
        <p>
          No se aceptan cambios ni devoluciones una vez confirmada la compra o
          reserva. No aplican devoluciones por inasistencia, llegada tardía,
          error en los datos ingresados por el usuario o incumplimiento de las
          condiciones de ingreso.
        </p>
      </LegalSection>

      <LegalSection title="Casos revisables">
        <p>
          Podrán revisarse casos de cobro duplicado, error operativo atribuible
          al comercio, cancelación o reprogramación del evento por parte del
          organizador.
        </p>
      </LegalSection>

      <LegalSection title="Cancelación o reprogramación">
        <p>
          Si el evento es cancelado por el organizador, {legal.tradeName} podrá
          ofrecer reprogramación o devolución. La devolución se gestionará por
          el mismo medio de pago cuando sea técnicamente posible.
        </p>
        <p>
          Los tiempos de abono pueden depender del banco emisor, billetera o
          pasarela de pago utilizada.
        </p>
      </LegalSection>

      <LegalSection title="Cómo solicitar revisión">
        <p>
          Para solicitar revisión de un caso, escribe a {legal.supportEmail} o
          usa el Libro de Reclamaciones con tu nombre, documento, evento, código
          de reserva o ticket y motivo de la solicitud.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
