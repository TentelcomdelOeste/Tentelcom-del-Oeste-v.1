export const getLowestAvailableQuoteNumber = (existingQuotes: { id: number | string, isDeleted?: boolean }[]): number => {
    const usedNumbers = existingQuotes
        .filter(q => !q.isDeleted)
        .map(q => {
            const val = parseInt(q.id.toString());
            return val;
        })
        .filter(n => !isNaN(n) && n > 0);
    
    if (usedNumbers.length === 0) {
        return 1;
    }
 
    const sortedNumbers = [...new Set(usedNumbers)].sort((a, b) => a - b);
    
    for (let i = 0; i < sortedNumbers.length; i++) {
        if (sortedNumbers[i] !== i + 1) {
            return i + 1;
        }
    }
    
    const next = sortedNumbers[sortedNumbers.length - 1] + 1;
    return next;
};

/**
 * Convierte un texto a formato Título (primera letra de cada palabra en mayúscula),
 * respetando caracteres especiales del español (á, é, í, ó, ú, ñ, etc.), signos y números.
 */
export const toTitleCaseSpanish = (str: string): string => {
    if (!str) return '';
    const lower = str.toLocaleLowerCase('es');
    return lower.replace(/(?:^|[\s\-_/(\[])\p{L}/gu, match => match.toLocaleUpperCase('es'));
};

/**
 * Convierte un texto a MAYÚSCULAS en español.
 */
export const toUpperCaseSpanish = (str: string): string => {
    if (!str) return '';
    return str.toLocaleUpperCase('es');
};

/**
 * Convierte un texto a minúsculas en español.
 */
export const toLowerCaseSpanish = (str: string): string => {
    if (!str) return '';
    return str.toLocaleLowerCase('es');
};
