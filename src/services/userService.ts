import { prisma } from "../db/prisma.js";
import { env } from "../config.js";
import { UserRole } from "@prisma/client";

type CreateUserInput = {
  username: string;
  password: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
};

type UpdateUserInput = Partial<CreateUserInput>;

export async function ensureSaUser() {
  const username = env.SA_USERNAME.trim();
  const password = env.SA_PASSWORD;
  const nombre = env.SA_NOMBRE.trim() || "sa";
  const apellido = env.SA_APELLIDO.trim() || "user";

  await prisma.users.upsert({
    where: { username },
    update: {
      password,
      nombre,
      apellido,
      rol: "sa",
      isActive: true,
    },
    create: {
      username,
      password,
      nombre,
      apellido,
      rol: "sa",
      isActive: true,
    },
  });
}

export async function createUser(data: CreateUserInput) {
  return prisma.users.create({ data });
}

export async function updateUser(id: number, data: UpdateUserInput) {
  return prisma.users.update({
    where: { id },
    data,
  });
}

export async function deactivateUser(id: number) {
  return prisma.users.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function findUserByCredentials(username: string, password: string) {
  return prisma.users.findFirst({
    where: {
      username,
      password,
      isActive: true,
    },
  });
}

export async function listUsers() {
  return prisma.users.findMany({
    orderBy: [{ id: "asc" }],
  });
}
