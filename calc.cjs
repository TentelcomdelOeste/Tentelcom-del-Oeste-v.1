const baseSalaryTotal = 550000;
const divisorValHora = 300;
const ordHoursQuincena = 150;

const valHoraOrg = baseSalaryTotal / divisorValHora;
const valHoraExt = valHoraOrg * 1.5;

// Simulación de una quincena estándar
const ordinaryPayment = Math.round(valHoraOrg * ordHoursQuincena * 100) / 100;
const extraHoursPayment = Math.round(valHoraExt * 0 * 100) / 100;
const holidayPayment = Math.round(valHoraOrg * 0 * 100) / 100;

const grossSalary = ordinaryPayment + extraHoursPayment + holidayPayment;
const ccss = Math.round((baseSalaryTotal * 0.0934 / 2) * 100) / 100;
const netPay = grossSalary - ccss;

console.log("=== AUDITORÍA PLANILLA ===");
console.log("Salario Mensual Base:", baseSalaryTotal);
console.log("Valor Hora Ordinaria (Base/300):", valHoraOrg.toFixed(2));
console.log("Valor Hora Extra (x1.5):", valHoraExt.toFixed(2));
console.log("Valor Hora Feriado (x1.0):", valHoraOrg.toFixed(2));
console.log("---------------------------");
console.log("Horas Ordinarias:", ordHoursQuincena);
console.log("Monto Ordinario:", ordinaryPayment);
console.log("Monto Extra:", extraHoursPayment);
console.log("Monto Feriado:", holidayPayment);
console.log("Salario Bruto:", grossSalary);
console.log("Deducción CCSS (Simulada @ 9.34%/2):", ccss);
console.log("Salario Neto:", netPay);
console.log("===========================");
