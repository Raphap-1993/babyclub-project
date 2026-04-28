import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../legal/LegalPage";
import { getLegalConfig } from "lib/legal";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Tratamiento de datos personales en Baby Club.",
};

export default function PrivacyPolicyPage() {
  const legal = getLegalConfig();

  return (
    <LegalPage
      eyebrow="Datos"
      title="Política de privacidad"
      description="Información sobre el tratamiento de datos personales usados para compras, reservas, acceso y soporte."
    >
      <LegalSection title="Datos que recopilamos">
        <p>
          Podemos recopilar nombre, apellidos, tipo y número de documento,
          correo electrónico, teléfono, evento seleccionado, tipo de entrada,
          reserva, comprobante de pago y datos necesarios para emitir o validar
          tickets digitales.
        </p>
      </LegalSection>

      <LegalSection title="Finalidades">
        <ul className="list-disc space-y-2 pl-5">
          <li>Procesar compras y reservas.</li>
          <li>Generar entradas digitales, códigos QR y códigos de reserva.</li>
          <li>Gestionar el acceso al evento y control de aforo.</li>
          <li>Enviar confirmaciones, avisos operativos o soporte.</li>
          <li>Atender reclamos, quejas o solicitudes del usuario.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Pasarela de pago">
        <p>
          {legal.tradeName} no almacena datos completos de tarjetas. Los datos
          de tarjeta son procesados por Culqi o la pasarela de pago
          correspondiente bajo sus propios estándares de seguridad.
        </p>
      </LegalSection>

      <LegalSection title="Conservación y terceros">
        <p>
          Los datos se conservarán durante el tiempo necesario para cumplir las
          finalidades descritas, obligaciones legales y trazabilidad operativa.
          Podrán ser compartidos solo con proveedores necesarios para pagos,
          correo transaccional, almacenamiento, seguridad o soporte.
        </p>
      </LegalSection>

      <LegalSection title="Derechos del titular">
        <p>
          Puedes solicitar acceso, rectificación, cancelación u oposición al
          tratamiento de tus datos personales escribiendo a {legal.supportEmail}
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
