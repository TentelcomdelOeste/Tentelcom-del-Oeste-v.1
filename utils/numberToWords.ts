
export function numeroALetras(num: number, moneda: string): string {
  const entero = Math.floor(num);
  const decimales = Math.round((num - entero) * 100);

  function unidades(n: number): string {
    const nombres = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    return nombres[n] || '';
  }

  function decenas(n: number): string {
    if (n < 10) return unidades(n);
    if (n === 10) return 'DIEZ';
    if (n === 11) return 'ONCE';
    if (n === 12) return 'DOCE';
    if (n === 13) return 'TRECE';
    if (n === 14) return 'CATORCE';
    if (n === 15) return 'QUINCE';
    if (n < 20) return 'DIECI' + unidades(n - 10);
    if (n === 20) return 'VEINTE';
    if (n < 30) return 'VEINTI' + unidades(n - 20);
    
    const d = Math.floor(n / 10);
    const u = n % 10;
    const nombres = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    return (nombres[d] || '') + (u > 0 ? ' Y ' + unidades(u) : '');
  }

  function centenas(n: number): string {
    if (n === 100) return 'CIEN';
    if (n < 100) return decenas(n);
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const nombres = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    return (nombres[c] || '') + (resto > 0 ? ' ' + decenas(resto) : '');
  }

  function seccion(n: number, divisor: number, strSingular: string, strPlural: string): string {
    const cientos = Math.floor(n / divisor);
    const resto = n % divisor;
    let letras = '';

    if (cientos > 0) {
      if (cientos > 1) letras = centenas(cientos) + ' ' + strPlural;
      else letras = strSingular;
    }

    if (resto > 0) letras += (letras !== '' ? ' ' : '') + convertir(resto);
    return letras;
  }

  function convertir(n: number): string {
    if (n < 1000) return centenas(n);
    if (n < 1000000) return seccion(n, 1000, 'MIL', 'MIL');
    return seccion(n, 1000000, 'UN MILLÓN', 'MILLONES');
  }

  let final = convertir(entero);
  if (!final || final === '') final = 'CERO';

  const sufijoMoneda = moneda === 'USD' ? 'DÓLARES' : 'COLONES';
  const céntimos = decimales < 10 ? '0' + decimales : decimales;

  return `${final} ${sufijoMoneda} CON ${céntimos}/100`;
}
    