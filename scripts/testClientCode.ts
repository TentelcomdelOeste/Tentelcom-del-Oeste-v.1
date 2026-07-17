import { generateNextClientCode } from '../services/clientCodeService';
import { Client } from '../types';

const testCases = [
  {
    name: 'Empty list',
    clients: [] as Client[],
    expected: 'CLI-001'
  },
  {
    name: 'Single client',
    clients: [{ codigoCliente: 'CLI-001' } as Client],
    expected: 'CLI-002'
  },
  {
    name: 'Gap in list',
    clients: [{ codigoCliente: 'CLI-001' } as Client, { codigoCliente: 'CLI-003' } as Client],
    expected: 'CLI-002'
  },
  {
    name: 'No gaps',
    clients: [{ codigoCliente: 'CLI-001' } as Client, { codigoCliente: 'CLI-002' } as Client],
    expected: 'CLI-003'
  },
  {
    name: 'Unordered list',
    clients: [{ codigoCliente: 'CLI-003' } as Client, { codigoCliente: 'CLI-001' } as Client],
    expected: 'CLI-002'
  }
];

console.log('--- Running Client Code Generation Tests ---');
testCases.forEach(tc => {
  const result = generateNextClientCode(tc.clients);
  console.log(`Test: ${tc.name} | Expected: ${tc.expected} | Got: ${result} | ${result === tc.expected ? 'PASS' : 'FAIL'}`);
});
