import React from "react";
import { createPortal } from "react-dom";

interface ModalPortalProps {
  children: React.ReactNode;
}

export function ModalPortal({ children }: ModalPortalProps) {
  if (typeof window === "undefined" || !document?.body) {
    return null;
  }
  return createPortal(children, document.body);
}
