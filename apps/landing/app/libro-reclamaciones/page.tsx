import type { Metadata } from "next";
import ClaimsForm from "./ClaimsForm";
import { LegalPage, LegalSection } from "../legal/LegalPage";
import { getLegalConfig } from "lib/legal";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones",
  description: "Libro de Reclamaciones Virtual de BABY.",
};

export default function ClaimsBookPage() {
  const legal = getLegalConfig();

  return (
    <LegalPage
      eyebrow="Atención al cliente"
      title="Libro de Reclamaciones"
      description="Registra una queja o reclamo relacionado con la compra de entradas, reservas de mesa o atención del evento."
    >
      <LegalSection title="Aviso">
        <p>
          {legal.tradeName} cuenta con Libro de Reclamaciones Virtual. Una vez
          registrada la solicitud, se generará un código de identificación y se
          enviará la constancia al correo ingresado.
        </p>
        <p>
          El plazo máximo de respuesta es de 30 días calendario. La respuesta se
          enviará al correo electrónico registrado por el usuario.
        </p>
      </LegalSection>

      <ClaimsForm />
    </LegalPage>
  );
}
