// Browser-only adapter. PAN, expiration and CVV stay inside MP hosted fields.
export async function tokenizeMercadoPagoCard(
  sdk: any,
  input: {
    holder: string;
    documentType: string;
    document: string;
    email: string;
    bin: string;
    amountCents: number;
  },
) {
  const type = input.documentType.replace(/[.\s]/g, "").toUpperCase();
  const document = input.document.trim();
  if (
    !input.holder.trim() ||
    !(
      { DNI: /^\d{8}$/, CE: /^[a-zA-Z0-9]{9,12}$/, RUC: /^\d{11}$/ } as Record<
        string,
        RegExp
      >
    )[type]?.test(document)
  ) {
    throw new Error(
      "Revisa el nombre y el documento del titular de la tarjeta.",
    );
  }
  if (!/^\d{6,8}$/.test(input.bin))
    throw new Error("Revisa el número de tarjeta.");
  const methods = await sdk.getPaymentMethods({ bin: input.bin });
  const method = methods.results?.find((item: any) =>
    ["credit_card", "debit_card"].includes(item.payment_type_id),
  );
  if (!method)
    throw new Error("Esta tarjeta no está disponible para la compra.");
  const token = await sdk.fields.createCardToken({
    cardholderName: input.holder.trim(),
    identificationType: type,
    identificationNumber: document,
  });
  if (!token?.id)
    throw new Error("No pudimos validar la tarjeta. Revisa sus datos.");
  return {
    token: token.id,
    payment_method_id: method.id,
    payment_type_id: method.payment_type_id,
    installments: 1,
    payer: { email: input.email },
  };
}
