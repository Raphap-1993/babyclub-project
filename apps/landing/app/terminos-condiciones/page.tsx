import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../legal/LegalPage";
import { getLegalConfig } from "lib/legal";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos y condiciones de compra de Baby Club.",
};

export default function TermsPage() {
  const legal = getLegalConfig();

  return (
    <LegalPage
      eyebrow="Legal"
      title="Términos y condiciones"
      description="Condiciones aplicables a la compra de entradas digitales y reservas de mesa para eventos Baby Club."
    >
      <LegalSection title="1. Identificación del comercio">
        <p>
          El presente sitio web es operado por {legal.tradeName}, organizador de
          eventos privados de entretenimiento en Perú.
        </p>
        <p>
          Para consultas relacionadas con compras, acceso o soporte, puedes
          escribir a {legal.supportEmail} o contactar a {legal.instagram}.
        </p>
      </LegalSection>

      <LegalSection title="2. Producto o servicio">
        <p>
          {legal.tradeName} ofrece entradas digitales y reservas de mesa para
          eventos específicos. Cada entrada otorga derecho de acceso al evento
          seleccionado, sujeto a aforo, validación del pago y condiciones de
          ingreso.
        </p>
      </LegalSection>

      <LegalSection title="3. Proceso de compra">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            El usuario selecciona evento, tipo de entrada o mesa disponible.
          </li>
          <li>El usuario debe proporcionar información veraz y completa.</li>
          <li>
            El pago puede realizarse mediante Yape/Plin o pasarela de pago
            online, según disponibilidad.
          </li>
          <li>
            Una vez confirmado el pago, se genera una entrada digital o reserva
            con código QR o código de reserva.
          </li>
          <li>
            La confirmación será enviada al correo o medio indicado por el
            usuario.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Medios de pago">
        <p>
          Se aceptan pagos mediante billeteras digitales y tarjetas de crédito o
          débito a través de Culqi, cuando el método esté disponible.{" "}
          {legal.tradeName} no almacena datos de tarjetas; esa información es
          procesada directamente por la pasarela de pago.
        </p>
      </LegalSection>

      <LegalSection title="5. Cambios y devoluciones">
        <p>
          No se aceptan cambios ni devoluciones una vez realizada la compra,
          salvo cancelación del evento por parte del organizador o supuestos
          exigidos por la normativa aplicable.
        </p>
        <p>
          En caso de cancelación atribuible al organizador, se podrá reprogramar
          el evento o realizar la devolución correspondiente a través del mismo
          medio de pago cuando sea posible.
        </p>
      </LegalSection>

      <LegalSection title="6. Condiciones de acceso">
        <ul className="list-disc space-y-2 pl-5">
          <li>El evento es exclusivo para mayores de 18 años.</li>
          <li>Es obligatorio presentar documento de identidad.</li>
          <li>
            Cada entrada cuenta con un código QR único, válido para un solo
            ingreso.
          </li>
          <li>
            El ingreso está sujeto a aforo, seguridad, validación del QR y
            derecho de admisión.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Aforo, admisión y permanencia">
        <p>
          Los eventos cuentan con aforo limitado. {legal.tradeName} puede
          regular el acceso para garantizar orden, seguridad y experiencia del
          evento.
        </p>
        <p>
          Se podrá impedir el ingreso o retirar del evento a personas en estado
          de ebriedad, bajo efectos de sustancias, con conductas agresivas o que
          incumplan las normas del evento.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilidad y uso de imagen">
        <p>
          {legal.tradeName} no se responsabiliza por pérdida de objetos
          personales, daños derivados de conductas de asistentes o hechos fuera
          de su control razonable.
        </p>
        <p>
          El asistente autoriza el uso de su imagen en material audiovisual del
          evento con fines informativos o promocionales, salvo comunicación
          expresa en contrario enviada al canal de soporte.
        </p>
      </LegalSection>

      <LegalSection title="9. Datos personales">
        <p>
          Los datos personales serán usados para procesar la compra, gestionar
          el acceso al evento, enviar confirmaciones y contactar al usuario
          cuando sea necesario. Para más detalle revisa la Política de
          Privacidad.
        </p>
      </LegalSection>

      <LegalSection title="10. Libro de reclamaciones y aceptación">
        <p>
          {legal.tradeName} pone a disposición un Libro de Reclamaciones virtual
          en esta web. Al realizar una compra, el usuario declara haber leído y
          aceptado estos Términos y Condiciones.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
