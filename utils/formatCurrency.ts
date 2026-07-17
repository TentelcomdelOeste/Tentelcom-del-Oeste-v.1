// utils/formatCurrency.ts
export const formatCurrency = (amount: number, currency: 'USD' | 'CRC' = 'CRC') => {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};