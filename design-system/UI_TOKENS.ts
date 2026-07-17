export const UI_TOKENS = {
  COLORS: {
    // Fondos
    bgPage: "bg-slate-50",
    bgContainer: "bg-white",
    bgHeader: "bg-slate-50",
    bgHover: "hover:bg-slate-50",
    bgHoverBlue: "hover:bg-blue-50/20",
    
    // Bordes
    border: "border-slate-200",
    borderLight: "border-slate-100",
    
    // Textos
    textPrimary: "text-blue-950",
    textSecondary: "text-slate-600",
    textMuted: "text-slate-400",
    
    // Estados
    success: "text-emerald-600 bg-emerald-100",
    warning: "text-amber-700 bg-amber-100",
    danger: "text-red-700 bg-red-100",
    info: "text-blue-700 bg-blue-100",
  },
  
  TYPOGRAPHY: {
    // Encabezados de tabla y etiquetas pequeñas
    label: "text-[10px] font-black uppercase tracking-widest",
    // Texto general de celdas
    body: "text-xs font-bold",
    // Números y montos
    mono: "font-mono font-black",
    // Títulos de módulos
    h1: "text-xl font-black uppercase tracking-tight",
    // Subtítulos
    h2: "text-sm font-bold",
  },
  
  SPACING: {
    tablePadding: "py-3 px-4",
    cardPadding: "p-6 md:p-8",
    inputPadding: "py-2.5 px-4",
  },
  
  SHAPE: {
    roundedInput: "rounded-xl",
    roundedContainer: "rounded-xl",
    roundedBadge: "rounded-full",
  }
} as const;