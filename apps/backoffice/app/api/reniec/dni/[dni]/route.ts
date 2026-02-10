import { NextRequest, NextResponse } from "next/server";

const RENIEC_API_URL = process.env.RENIEC_API_URL || "";
const RENIEC_API_TOKEN = process.env.RENIEC_API_TOKEN || "";

export async function GET(
  req: NextRequest, 
  context: { params: Promise<{ dni: string }> }
) {
  const params = await context.params;
  const dni = params.dni;

  if (!dni || dni.length !== 8) {
    return NextResponse.json(
      { success: false, error: "DNI debe tener 8 dígitos" },
      { status: 400 }
    );
  }

  if (!RENIEC_API_URL || !RENIEC_API_TOKEN) {
    return NextResponse.json(
      { success: false, error: "Configuración de Reniec no disponible" },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${RENIEC_API_URL}?numero=${dni}`, {
      headers: {
        Authorization: `Bearer ${RENIEC_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "No se pudo consultar Reniec" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data: {
        dni: data.numeroDocumento || dni,
        nombres: data.nombres || "",
        apellidoPaterno: data.apellidoPaterno || "",
        apellidoMaterno: data.apellidoMaterno || "",
      },
    });
  } catch (error: any) {
    console.error("Error calling Reniec API:", error);
    return NextResponse.json(
      { success: false, error: "Error al consultar Reniec" },
      { status: 500 }
    );
  }
}
