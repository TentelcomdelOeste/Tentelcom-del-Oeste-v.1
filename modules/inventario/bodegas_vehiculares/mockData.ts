import { VEHICLES } from '../../job_scheduling/JobForm';
import { extraerPlaca } from '../../../types/vehicle.types';
import {
  VehicleWarehouseItem,
  VehicleMaterialRequest,
  VehicleMovement,
  VehicleProjectConsumption
} from '../../../types/vehicleWarehouse.types';

// Únicas unidades excluidas para bodegas vehiculares
export const BODEGA_EXCLUDED_VEHICLES = ['U3', 'U7'];

export const formatVehicleOptionLabel = (label: string): string => {
  const parts = label.split(' - ');
  if (parts.length >= 2) {
    return `${parts[0].trim()} - ${parts[1].trim()}`;
  }
  return label;
};

export const mockVehicles = VEHICLES
  .filter(v => !BODEGA_EXCLUDED_VEHICLES.includes(v.value))
  .map(v => {
    const displayLabel = formatVehicleOptionLabel(v.label);
    return {
      id: v.value,
      placa: extraerPlaca(v.label) || v.label,
      alias: displayLabel,
      displayName: displayLabel,
      label: displayLabel,
      fullLabel: v.label
    };
  });

export const mockProjects = [
  { id: 'proj-1', code: '#105-2026', name: 'Instalación Fibra Sede Central' },
  { id: 'proj-2', code: '#106-2026', name: 'Mantenimiento Torre Norte' },
  { id: 'proj-3', code: '#107-2026', name: 'Cableado Estructurado Oficinas' },
];

export const mockWarehouseItems: VehicleWarehouseItem[] = [
  {
    id: 'U1_item-1',
    vehiculoId: 'U1',
    vehiculoPlaca: '532995',
    vehiculoAlias: 'U1',
    inventoryItemId: 'item-1',
    code: 'CBL-UTP-CAT6',
    description: 'Cable UTP Cat 6 Exterior',
    category: 'Cables',
    unit: 'm',
    physicalStock: 500,
    committedStock: 200,
    availableStock: 300,
    updatedAt: new Date().toISOString(),
    updatedBy: 'user-1'
  },
  {
    id: 'U1_item-2',
    vehiculoId: 'U1',
    vehiculoPlaca: '532995',
    vehiculoAlias: 'U1',
    inventoryItemId: 'item-2',
    code: 'FBR-OPT-04',
    description: 'Fibra Óptica 4 Hilos',
    category: 'Fibra',
    unit: 'm',
    physicalStock: 250,
    committedStock: 50,
    availableStock: 200,
    updatedAt: new Date().toISOString(),
    updatedBy: 'user-1'
  },
  {
    id: 'U1_item-3',
    vehiculoId: 'U1',
    vehiculoPlaca: '532995',
    vehiculoAlias: 'U1',
    inventoryItemId: 'item-3',
    code: 'CON-RJ45',
    description: 'Conectores RJ45 Cat 6',
    category: 'Conectores',
    unit: 'und',
    physicalStock: 80,
    committedStock: 80,
    availableStock: 0,
    updatedAt: new Date().toISOString(),
    updatedBy: 'user-1'
  },
  {
    id: 'U1_item-4',
    vehiculoId: 'U1',
    vehiculoPlaca: '532995',
    vehiculoAlias: 'U1',
    inventoryItemId: 'item-4',
    code: 'TUB-PVC-34',
    description: 'Tubería PVC 3/4"',
    category: 'Tubería',
    unit: 'm',
    physicalStock: 120,
    committedStock: 20,
    availableStock: 100,
    updatedAt: new Date().toISOString(),
    updatedBy: 'user-1'
  },
  {
    id: 'U2_item-1',
    vehiculoId: 'U2',
    vehiculoPlaca: '420101',
    vehiculoAlias: 'U2',
    inventoryItemId: 'item-1',
    code: 'CBL-UTP-CAT6',
    description: 'Cable UTP Cat 6 Exterior',
    category: 'Cables',
    unit: 'm',
    physicalStock: 50,
    committedStock: 0,
    availableStock: 50,
    updatedAt: new Date().toISOString(),
    updatedBy: 'user-1'
  },
  {
    id: 'U2_item-4',
    vehiculoId: 'U2',
    vehiculoPlaca: '420101',
    vehiculoAlias: 'U2',
    inventoryItemId: 'item-4',
    code: 'TUB-PVC-34',
    description: 'Tubería PVC 3/4"',
    category: 'Tubería',
    unit: 'm',
    physicalStock: 30,
    committedStock: 0,
    availableStock: 30,
    updatedAt: new Date().toISOString(),
    updatedBy: 'user-1'
  },
  {
    id: 'U4_item-2',
    vehiculoId: 'U4',
    vehiculoPlaca: 'AAE-026',
    vehiculoAlias: 'U4',
    inventoryItemId: 'item-2',
    code: 'FBR-OPT-04',
    description: 'Fibra Óptica 4 Hilos',
    category: 'Fibra',
    unit: 'm',
    physicalStock: 100,
    committedStock: 0,
    availableStock: 100,
    updatedAt: new Date().toISOString(),
    updatedBy: 'user-1'
  }
];

export const mockMaterialRequests: VehicleMaterialRequest[] = [
  {
    id: 'req-1',
    requestNumber: 'SOL-VEH-0001',
    vehiculoId: 'U1',
    vehiculoAlias: 'U1',
    vehiculoPlaca: '532995',
    projectId: 'proj-1',
    projectCode: '#105-2026',
    projectName: 'Instalación Fibra Sede Central',
    responsibleId: 'user-1',
    responsibleName: 'Juan Pérez',
    status: 'Abierta',
    openedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    items: [
      {
        inventoryItemId: 'item-1',
        code: 'CBL-UTP-CAT6',
        description: 'Cable UTP Cat 6 Exterior',
        unit: 'm',
        quantityCommitted: 200
      },
      {
        inventoryItemId: 'item-2',
        code: 'FBR-OPT-04',
        description: 'Fibra Óptica 4 Hilos',
        unit: 'm',
        quantityCommitted: 50
      },
      {
        inventoryItemId: 'item-3',
        code: 'CON-RJ45',
        description: 'Conectores RJ45 Cat 6',
        unit: 'und',
        quantityCommitted: 80
      },
      {
        inventoryItemId: 'item-4',
        code: 'TUB-PVC-34',
        description: 'Tubería PVC 3/4"',
        unit: 'm',
        quantityCommitted: 20
      }
    ],
    additionsLog: [
      {
        additionId: 'add-1',
        date: new Date(Date.now() - 86400000 * 5).toISOString(),
        addedBy: 'user-1',
        addedByName: 'Juan Pérez',
        items: [
          { inventoryItemId: 'item-1', quantity: 200 },
          { inventoryItemId: 'item-3', quantity: 80 }
        ]
      },
      {
        additionId: 'add-2',
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        addedBy: 'user-1',
        addedByName: 'Juan Pérez',
        notes: 'Material extra requerido por cliente',
        items: [
          { inventoryItemId: 'item-2', quantity: 50 },
          { inventoryItemId: 'item-4', quantity: 20 }
        ]
      }
    ],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    createdBy: 'user-1',
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedBy: 'user-1'
  },
  {
    id: 'req-2',
    requestNumber: 'SOL-VEH-0002',
    vehiculoId: 'U2',
    vehiculoAlias: 'U2',
    vehiculoPlaca: '420101',
    projectId: 'proj-2',
    projectCode: '#106-2026',
    projectName: 'Mantenimiento Torre Norte',
    responsibleId: 'user-2',
    responsibleName: 'Carlos Gómez',
    status: 'Cerrada',
    openedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    closedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    closedBy: 'user-2',
    closedByName: 'Carlos Gómez',
    items: [
      {
        inventoryItemId: 'item-1',
        code: 'CBL-UTP-CAT6',
        description: 'Cable UTP Cat 6 Exterior',
        unit: 'm',
        quantityCommitted: 50,
        quantityUsed: 42,
        quantitySurplus: 8
      }
    ],
    additionsLog: [
      {
        additionId: 'add-1',
        date: new Date(Date.now() - 86400000 * 10).toISOString(),
        addedBy: 'user-2',
        addedByName: 'Carlos Gómez',
        items: [
          { inventoryItemId: 'item-1', quantity: 50 }
        ]
      }
    ],
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    createdBy: 'user-2',
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedBy: 'user-2'
  }
];

export const mockMovements: VehicleMovement[] = [
  {
    id: 'mov-1',
    movementNumber: 'MOV-VEH-0001',
    type: 'Traslado_Entrada',
    vehiculoId: 'U1',
    vehiculoPlaca: '532995',
    items: [
      {
        inventoryItemId: 'item-1',
        code: 'CBL-UTP-CAT6',
        description: 'Cable UTP Cat 6 Exterior',
        quantity: 500,
        previousPhysicalStock: 0,
        newPhysicalStock: 500
      }
    ],
    date: new Date(Date.now() - 86400000 * 6).toISOString().split('T')[0],
    reason: 'Abastecimiento inicial de unidad U1',
    performedBy: 'user-admin',
    performedByName: 'Admin Sistema',
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString()
  },
  {
    id: 'mov-2',
    movementNumber: 'MOV-VEH-0002',
    type: 'Consumo_Proyecto',
    vehiculoId: 'U2',
    vehiculoPlaca: '420101',
    projectId: 'proj-2',
    projectName: 'Mantenimiento Torre Norte',
    requestId: 'req-2',
    items: [
      {
        inventoryItemId: 'item-1',
        code: 'CBL-UTP-CAT6',
        description: 'Cable UTP Cat 6 Exterior',
        quantity: 42,
        previousPhysicalStock: 92,
        newPhysicalStock: 50,
        previousCommittedStock: 50,
        newCommittedStock: 0
      }
    ],
    date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
    reason: 'Cierre de solicitud SOL-VEH-0002',
    performedBy: 'user-2',
    performedByName: 'Carlos Gómez',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
  }
];

export const mockConsumptions: VehicleProjectConsumption[] = [
  {
    id: 'cons-1',
    requestId: 'req-2',
    requestNumber: 'SOL-VEH-0002',
    projectId: 'proj-2',
    projectCode: '#106-2026',
    projectName: 'Mantenimiento Torre Norte',
    vehiculoId: 'U2',
    vehiculoAlias: 'U2',
    responsibleId: 'user-2',
    responsibleName: 'Carlos Gómez',
    closedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    closedBy: 'user-2',
    items: [
      {
        inventoryItemId: 'item-1',
        code: 'CBL-UTP-CAT6',
        description: 'Cable UTP Cat 6 Exterior',
        unit: 'm',
        committed: 50,
        consumed: 42,
        surplus: 8
      }
    ],
    totalItemsConsumed: 42
  }
];
