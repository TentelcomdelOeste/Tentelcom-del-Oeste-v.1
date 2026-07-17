import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection
} from "firebase/firestore";

import { db } from "../firebase";
import { guardedWrite } from "./writeGuard";

export async function safeCreate(
  path: string,
  data: any
) {

  if (!data) {
    throw new Error("WRITE_BLOCKED: data undefined");
  }

  // Se añade createdAt timestamp manteniendo los datos originales
  return guardedWrite(() => addDoc(collection(db, path), {
    ...data,
    createdAt: Date.now()
  }));
}

export async function safeUpdate(
  path: string,
  id: string,
  data: any
) {

  if (!id) {
    throw new Error("WRITE_BLOCKED: missing id");
  }

  // Se añade updatedAt timestamp manteniendo los datos originales
  return guardedWrite(() => updateDoc(doc(db, path, id), {
    ...data,
    updatedAt: Date.now()
  }));
}

export async function safeDelete(
  path: string,
  id: string
) {

  if (!id) {
    throw new Error("WRITE_BLOCKED: missing id");
  }

  return guardedWrite(() => deleteDoc(doc(db, path, id)));
}