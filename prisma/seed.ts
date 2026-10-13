import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db";

async function main() {
  // 1) Las 3 sucursales
  for (const nombre of ["NORTE", "OESTE", "SUR"] as const) {
    await prisma.sucursal.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  // 2) Usuario administrador (credenciales desde el .env, nunca escritas acá)
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Falta SEED_ADMIN_EMAIL o SEED_ADMIN_PASSWORD en el archivo .env");
  }

  const norte = await prisma.sucursal.findUniqueOrThrow({ where: { nombre: "NORTE" } });

  await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      nombre: "Administrador",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      rol: "ADMIN",
      sucursalId: norte.id, // el ADMIN ve todas las sucursales igual; esta es solo su sucursal base
    },
  });

  console.log("Seed OK: sucursales NORTE/OESTE/SUR + usuario admin");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
