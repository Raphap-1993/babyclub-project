// The official Brick resolves brand, debit/credit and issuer rules for Peru.
// Only allowlisted tokenized fields cross the BABY boundary.
export function mercadoPagoCardPayment(form: any, additional: any) {
  const type = additional?.paymentTypeId;
  if (!["credit_card", "debit_card"].includes(type))
    throw new Error("Esta tarjeta no está disponible para la compra.");
  if (typeof form?.token !== "string" || !form.token)
    throw new Error("No pudimos validar la tarjeta. Revisa sus datos.");
  return {
    token: form.token,
    payment_method_id: form.payment_method_id,
    payment_type_id: type,
    installments: form.installments,
    payer: {
      email: form.payer?.email,
      ...(form.payer?.identification
        ? {
            identification: {
              type: form.payer.identification.type,
              number: form.payer.identification.number,
            },
          }
        : {}),
    },
  };
}
