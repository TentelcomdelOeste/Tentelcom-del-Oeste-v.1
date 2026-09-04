export const MODULES_CONFIG = {
  cotizaciones: { label: "Cotizaciones" },
  pre_analysis: { label: "Evaluación de Proyectos" },
  trabajos: { label: "Programación de Trabajos" },
  external_products: { label: "Catálogo Externo" },

  bitacoraVehiculos: {
    label: "Bitácora de Vehículos",
    submodules: {
      registros: "Registros de Bitácora",
      analisis: "Análisis de Flota"
    }
  },

  inventario: {
    label: "Inventario",
    submodules: {
      general: "Inventario General",
      movimientos: "Movimientos Stock",
      solicitudes: "Solicitudes",
      reportes: "Reporte de Materiales",
      bodegas_vehiculares: "Bodegas Vehiculares"
    }
  },

  finanzas: {
    label: "Finanzas / RRHH",
    submodules: {
      empleados: "Colaboradores",
      ausencias: "Ausencias",
      payroll: "Planilla Corporativa",
      comprobantes: "Colillas",
      movimientos: "Movimientos",
      analisis: "Análisis Proyectos",
      facturacion: "Facturación",
      ordenes_compra: "Órdenes de Compra"
    }
  },
  web_analysis: { label: "Análisis Web" }
};
