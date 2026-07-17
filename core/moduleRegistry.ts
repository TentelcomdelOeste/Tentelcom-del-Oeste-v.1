export type PermissionTier = 'boolean' | 'nested';

export interface ModuleDefinition {
  id: string;
  label: string;
  category: 'Ventas' | 'Inventario' | 'Finanzas / RRHH' | 'Sistema';
  permissionKey: string;
  type: PermissionTier;
  subPermissions?: {
    key: string;
    label: string;
  }[];
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 'quotes',
    label: 'Gestión de Proyectos',
    category: 'GESTIÓN DE PROYECTOS',
    permissionKey: 'cotizaciones',
    type: 'boolean'
  },
  {
    id: 'pre_analysis',
    label: 'Evaluación de Proyectos',
    category: 'GESTIÓN DE PROYECTOS',
    permissionKey: 'pre_analysis',
    type: 'boolean'
  },
  {
    id: 'finance',
    label: 'Gestión Financiera',
    category: 'FINANZAS / RRHH',
    permissionKey: 'finanzas',
    type: 'nested',
    subPermissions: [
      { key: 'empleados', label: 'Colaboradores' },
      { key: 'ausencias', label: 'Ausencias' },
      { key: 'payroll', label: 'Planilla Corporativa' },
      { key: 'comprobantes', label: 'Colillas' },
      { key: 'movimientos', label: 'Movimientos' },
      { key: 'analisis', label: 'Análisis Proyectos' },
      { key: 'facturacion', label: 'Facturación' },
      { key: 'ordenes_compra', label: 'Órdenes de Compra' }
    ]
  },
  {
    id: 'inventory',
    label: 'Inventario',
    category: 'INVENTARIO',
    permissionKey: 'inventario',
    type: 'nested',
    subPermissions: [
      { key: 'general', label: 'Inventario General' },
      { key: 'movimientos', label: 'Movimientos Stock' },
      { key: 'solicitudes', label: 'Solicitudes' },
      { key: 'reporte_materiales', label: 'Reporte de Materiales' }
    ]
  },
  {
    id: 'external_products',
    label: 'Revisión Productos',
    category: 'INTEGRACIÓN EXTERNA',
    permissionKey: 'external_products',
    type: 'boolean'
  }
];
