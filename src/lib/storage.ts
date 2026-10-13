import { v2 as cloudinary } from "cloudinary";
import { HttpError } from "../errors";

// Los documentos (DNI, carnet, póliza) son datos personales: se suben con
// type "authenticated", o sea que NO se pueden abrir sin una URL firmada.
// Si más adelante se cambia Cloudinary por S3/R2, solo hay que reescribir este archivo.

let listo = false;
function iniciar() {
  if (listo) return;
  const {
    CLOUDINARY_CLOUD_NAME: cloud_name,
    CLOUDINARY_API_KEY: api_key,
    CLOUDINARY_API_SECRET: api_secret,
  } = process.env;
  if (!cloud_name || !api_key || !api_secret) {
    throw new HttpError(503, "El almacenamiento de archivos todavía no está configurado");
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  listo = true;
}

export type FormatoArchivo = "JPG" | "PDF";

// Verifica el contenido real del archivo, no solo la extensión o el mimetype
export function detectarFormato(buf: Buffer): FormatoArchivo | null {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "JPG";
  if (buf.length > 4 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "PDF";
  return null;
}

export function subirArchivo(buffer: Buffer, carpeta: string): Promise<string> {
  iniciar();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: carpeta, resource_type: "image", type: "authenticated" },
      (err, res) => (err || !res ? reject(err ?? new Error("Falló la subida")) : resolve(res.public_id)),
    );
    stream.end(buffer);
  });
}

export function urlFirmada(clave: string, formato: FormatoArchivo): string {
  iniciar();
  return cloudinary.url(clave, {
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
    format: formato === "PDF" ? "pdf" : "jpg",
  });
}

// Mejor esfuerzo: si falla, el archivo huérfano no rompe la operación
export async function borrarArchivo(clave: string): Promise<void> {
  try {
    iniciar();
    await cloudinary.uploader.destroy(clave, {
      resource_type: "image",
      type: "authenticated",
      invalidate: true,
    });
  } catch (e) {
    console.error("No se pudo borrar el archivo", clave, e);
  }
}
