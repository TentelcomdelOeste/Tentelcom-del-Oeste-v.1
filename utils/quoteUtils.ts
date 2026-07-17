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
