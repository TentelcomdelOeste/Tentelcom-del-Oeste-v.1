import { useLayoutEffect } from "react";

let lockCount = 0;
let originalBodyOverflow = '';
let originalBodyTouchAction = '';
let originalMainOverflow = '';

export default function useLockBodyScroll(isOpen: boolean) {
  useLayoutEffect(() => {
    if (!isOpen) return;

    if (lockCount === 0) {
      // Capturar estado original para restauración precisa
      originalBodyOverflow = window.getComputedStyle(document.body).overflow;
      originalBodyTouchAction = document.body.style.touchAction;
      
      // Bloqueo agresivo para evitar scroll fantasma en body
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";

      // Bloquear también el contenedor principal (main) que tiene el scroll
      const mainContainer = document.querySelector('main');
      if (mainContainer) {
        originalMainOverflow = window.getComputedStyle(mainContainer).overflow;
        mainContainer.style.setProperty('overflow', 'hidden', 'important');
      }
    }
    
    lockCount++;

    return () => {
      lockCount--;
      
      if (lockCount === 0) {
        // Restauración limpia al desmontar o cerrar
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.touchAction = originalBodyTouchAction;
        
        const mainContainer = document.querySelector('main');
        if (mainContainer) {
          mainContainer.style.overflow = originalMainOverflow;
        }
      }
    };
  }, [isOpen]);
}