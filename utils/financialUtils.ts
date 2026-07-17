export const isValidExchangeRate = (rate: number | undefined | null): boolean => {
    return rate !== undefined && rate !== null && rate > 0 && !Number.isNaN(rate);
};
