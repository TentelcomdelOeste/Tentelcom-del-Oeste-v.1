export const useHapticFeedback = () => {
    const isMobile = (): boolean => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    };

    const isHapticSupported = (): boolean => {
        return isMobile() && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    };

    // Patrones basados en análisis ADB de Samsung EFFECT_SWITCH (aproximación web suave y orgánica)
    const hapticPatterns = {
        SI: [8, 3, 8],      // Confirmación positiva (triple micro vibración, duración total: 19ms)
        NO: [12, 5, 12],    // Negación (patrón doble perceptible, duración total: 29ms)
        NA: [15, 4, 15]     // Neutral (ondulante suave, duración total: 34ms)
    };

    const triggerHaptic = (pattern: number | number[]): void => {
        if (isHapticSupported()) {
            try {
                navigator.vibrate(pattern);
            } catch {
                // Manejo resiliente si el navegador restringe o bloquea la API de vibración
            }
        }
    };

    return { triggerHaptic, isHapticSupported, hapticPatterns };
};

