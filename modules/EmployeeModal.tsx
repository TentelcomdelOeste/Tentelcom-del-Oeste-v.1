import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Employee, ModulePermissions } from '../financeTypes';
import { FiX, FiAlertCircle, FiSave, FiLock, FiShield, FiEye, FiEyeOff, FiRefreshCcw } from "react-icons/fi";
import { ActionButton, IconButton } from '../design-system';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { MODULES_CONFIG } from '../utils/permissionsConfig';

interface EmployeeModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: any, id?: string) => Promise<{ success: boolean; message?: string; }>;
  onResetPassword?: (id: string) => Promise<void>;
  onAdminSetPassword?: (id: string, pass: string) => Promise<void>;
  employeeData?: Employee | null;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({ 
    show, onClose, onSubmit, onResetPassword, onAdminSetPassword, employeeData 
}) => {
  useLockBodyScroll(show);

  const isEditing = !!employeeData?.id;
  
  const [name, setName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [position, setPosition] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [reportadoCCSS, setReportadoCCSS] = useState('');
  const [ccssDeduction, setCcssDeduction] = useState('');
  const [ccssDeductionQuincenal, setCcssDeductionQuincenal] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'empleado' | 'supervisor'>('empleado');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'activo' | 'archivado'>('activo');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [canUseOperationalLog, setCanUseOperationalLog] = useState(false);

  // Permisos
  const [permissions, setPermissions] = useState<ModulePermissions>({
    cotizaciones: false,
    pre_analysis: false,
    trabajos: false,
    inventario: { general: false, movimientos: false, solicitudes: false },
    finanzas: { movimientos: false, analisis: false, comprobantes: false, ausencias: false, empleados: false, facturacion: false, ordenes_compra: false, payroll: false },
    external_products: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassModal, setShowPassModal] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (show) {
        if (employeeData) {
            setName(employeeData.name);
            setEmployeeCode(employeeData.employeeCode);
            setPosition(employeeData.position);
            setBaseSalary(employeeData.baseSalary.toString());
            setReportadoCCSS((employeeData.reportadoCCSS || 0).toString());
            setCcssDeduction(employeeData.ccssDeduction.toString());
            setCcssDeductionQuincenal((employeeData.ccssDeductionQuincenal || 0).toString());
            setPhone(employeeData.phone);
            setEmail(employeeData.email);
            setRole(employeeData.role);
            setUsername(employeeData.username || '');
            setPassword('');
            setStatus(employeeData.status || 'activo');
            setHireDate(employeeData.hireDate || new Date().toISOString().split('T')[0]);
            setCanUseOperationalLog(employeeData.canUseOperationalLog || false);
            setPermissions(employeeData.permissions || {
                cotizaciones: false,
                pre_analysis: false,
                inventario: { general: false, movimientos: false, solicitudes: false, precios: false },
                finanzas: { movimientos: false, analisis: false, comprobantes: false, ausencias: false, empleados: false, facturacion: false, ordenes_compra: false, payroll: false },
                external_products: false,
                configuracion: false
            });
        } else {
            setName('');
            setEmployeeCode('');
            setPosition('');
            setBaseSalary('');
            setReportadoCCSS('');
            setCcssDeduction('');
            setCcssDeductionQuincenal('');
            setPhone('');
            setEmail('');
            setRole('empleado');
            setUsername('');
            setPassword('');
            setStatus('activo');
            setHireDate(new Date().toISOString().split('T')[0]);
            setCanUseOperationalLog(false);
            setPermissions({
                cotizaciones: false,
                pre_analysis: false,
                inventario: { general: false, movimientos: false, solicitudes: false, precios: false },
                finanzas: { movimientos: false, analisis: false, comprobantes: false, ausencias: false, empleados: false, facturacion: false, ordenes_compra: false, payroll: false },
                external_products: false,
                configuracion: false
            });
        }
        setError(null);
    }
  }, [show, employeeData]);

  useEffect(() => {
    const val = parseFloat(reportadoCCSS);
    if (!isNaN(val)) {
        const calculated = Math.round((val * 0.1083) * 100) / 100;
        setCcssDeduction(calculated.toString());
        setCcssDeductionQuincenal((Math.round((calculated / 2) * 100) / 100).toString());
    } else {
        setCcssDeduction('');
        setCcssDeductionQuincenal('');
    }
  }, [reportadoCCSS]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (!name || !employeeCode || !position || !baseSalary || !email || !username || (!isEditing && !password)) {
        setError("Los campos marcados con * son obligatorios.");
        return;
    }

    setIsSubmitting(true);
    try {
        const payload: any = {
            name,
            employeeCode,
            position,
            baseSalary: parseFloat(baseSalary),
            ccssDeduction: parseFloat(ccssDeduction) || 0,
            ccssDeductionQuincenal: parseFloat(ccssDeductionQuincenal) || 0,
            reportadoCCSS: parseFloat(reportadoCCSS) || 0,
            phone,
            email,
            role,
            username,
            status,
            hireDate,
            canUseOperationalLog,
            permissions
        };

        if (!isEditing) {
            payload.password = password;
        }

        const result = await onSubmit(payload, employeeData?.id);

        if (!result.success) {
            setError(result.message || "Error al guardar colaborador");
            return;
        }
        onClose();
    } catch (err: any) {
        console.error("❌ Error guardando (EmployeeModal):", err);
        setError(err.message || "Error al guardar el colaborador.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const togglePermission = (path: string) => {
    const newPermissions = { ...permissions };
    const parts = path.split('.');
    
    if (parts.length === 1) {
        (newPermissions as any)[parts[0]] = !(newPermissions as any)[parts[0]];
    } else if (parts.length === 2) {
        const parent = (newPermissions as any)[parts[0]];
        if (parent && typeof parent === 'object') {
            parent[parts[1]] = !parent[parts[1]];
        } else {
            (newPermissions as any)[parts[0]] = { [parts[1]]: true };
        }
    }
    setPermissions(newPermissions);
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let newPass = "";
    for (let i = 0; i < 10; i++) {
        newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(newPass);
    setShowPassword(true);
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-[32px] flex-none">
                <div>
                    <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">{employeeData ? 'Editar Colaborador' : 'Nuevo Colaborador'}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestión de Personal y Accesos</p>
                </div>
                <div className="flex items-center gap-2">
                    {employeeData && onAdminSetPassword && (
                        <IconButton 
                            type="button" 
                            onClick={() => setShowPassModal(true)}
                            icon={<FiLock />}
                            variant="neutral"
                            title="Cambiar Contraseña"
                        />
                    )}
                    <IconButton 
                        variant="neutral" 
                        icon={<FiX />} 
                        onClick={onClose} 
                        title="Cerrar"
                    />
                </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
                
                {/* Información Básica */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-4 h-px bg-blue-200"></span> Datos Personales
                        </h4>
                    </div>
                    
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Nombre Completo *</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            placeholder="Nombre del empleado"
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Código de Empleado *</label>
                        <input 
                            type="text" 
                            value={employeeCode} 
                            onChange={e => setEmployeeCode(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            placeholder="Ej: EMP-001"
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Correo Electrónico *</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            placeholder="correo@empresa.com"
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Teléfono</label>
                        <input 
                            type="text" 
                            value={phone} 
                            onChange={e => setPhone(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            placeholder="8888-8888"
                        />
                    </div>

                    <div className="col-span-2">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-4 mb-3 flex items-center gap-2">
                            <span className="w-4 h-px bg-blue-200"></span> Información Laboral
                        </h4>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Puesto / Cargo *</label>
                        <input 
                            type="text" 
                            value={position} 
                            onChange={e => setPosition(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            placeholder="Ej: Técnico"
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fecha de Ingreso</label>
                        <input 
                            type="date" 
                            value={hireDate} 
                            onChange={e => setHireDate(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Salario Base *</label>
                        <input 
                            type="number" 
                            value={baseSalary} 
                            onChange={e => setBaseSalary(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            placeholder="0.00"
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Salario Reportado CCSS *</label>
                        <input 
                            type="number" 
                            value={reportadoCCSS} 
                            onChange={e => setReportadoCCSS(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            placeholder="0.00"
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Deducción CCSS (Autocalculada) *</label>
                        <input 
                            type="number" 
                            value={ccssDeduction} 
                            readOnly
                            className="w-full p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-400 outline-none transition-all" 
                            placeholder="0.00"
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Deducción CCSS Quincenal *</label>
                        <input 
                            type="number" 
                            value={ccssDeductionQuincenal} 
                            readOnly
                            className="w-full p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-400 outline-none transition-all" 
                            placeholder="0.00"
                        />
                    </div>

                    <div className="col-span-2">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-4 mb-3 flex items-center gap-2">
                            <span className="w-4 h-px bg-blue-200"></span> Acceso al Sistema
                        </h4>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Usuario *</label>
                        <input 
                            type="text" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            placeholder="nombre.apellido"
                        />
                    </div>

                    {!employeeData?.id && (
                        <div className="col-span-2 sm:col-span-1 relative">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Contraseña *</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all pr-20" 
                                    placeholder="********"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <IconButton 
                                        type="button"
                                        onClick={generatePassword}
                                        title="Generar contraseña"
                                        icon={<FiRefreshCcw size={14} />}
                                        className="!w-8 !h-8 !p-0 !rounded-lg"
                                        variant="neutral"
                                    />
                                    <IconButton 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        title={showPassword ? "Ocultar" : "Mostrar"}
                                        icon={showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                                        className="!w-8 !h-8 !p-0 !rounded-lg"
                                        variant="neutral"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Rol de Usuario</label>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value as any)}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            <option value="empleado">Empleado</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>

                    {/* Permisos */}
                    <div className="col-span-2 mt-4">
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FiShield className="text-blue-500" /> Permisos de Módulos
                            </h5>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-2">
                                    {Object.entries(MODULES_CONFIG).map(([key, module]) => {
                                        if (!('submodules' in module)) {
                                            return (
                                                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                                                    <input type="checkbox" checked={!!(permissions as any)[key]} onChange={() => togglePermission(key)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                                    <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600 transition-colors">{module.label}</span>
                                                </label>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>

                                <div className="space-y-4">
                                    {Object.entries(MODULES_CONFIG).map(([key, module]) => {
                                        if ('submodules' in module) {
                                            return (
                                                <div key={key}>
                                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">{module.label}</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {Object.entries(module.submodules).map(([subKey, subLabel]) => (
                                                            <label key={`${key}.${subKey}`} className="flex items-center gap-2 cursor-pointer group">
                                                                <input type="checkbox" checked={!!((permissions as any)[key] && (permissions as any)[key][subKey])} onChange={() => togglePermission(`${key}.${subKey}`)} className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                                                <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors capitalize">{subLabel}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>

                            <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4 mt-6 flex items-center gap-2">
                                <FiShield className="text-amber-500" /> Permisos Especiales (BETA)
                            </h5>
                            <div className="grid grid-cols-1 gap-x-6 gap-y-4">
                                <label className="flex items-center gap-3 cursor-pointer group bg-amber-50 p-2 rounded-lg border border-amber-100">
                                    <input 
                                        type="checkbox" 
                                        checked={canUseOperationalLog} 
                                        onChange={(e) => setCanUseOperationalLog(e.target.checked)} 
                                        className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" 
                                    />
                                    <span className="text-xs font-bold text-amber-800">Bitácora Operativa (BETA)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 text-center animate-pulse">
                        <FiAlertCircle className="mr-1 inline"  /> {error}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 flex gap-3 border-t border-slate-100 flex-none">
                <ActionButton 
                    type="button" 
                    onClick={onClose} 
                    label="Cancelar"
                    variant="secondary"
                    className="flex-1 !py-3 !text-xs !font-bold !uppercase !rounded-xl"
                />
                <ActionButton 
                    type="submit" 
                    disabled={isSubmitting} 
                    isLoading={isSubmitting}
                    label={employeeData ? 'Guardar' : 'Registrar Colaborador'}
                    icon={<FiSave />}
                    variant="primary"
                    className="flex-1 !py-3 !text-xs !font-black !uppercase !tracking-wider !rounded-xl"
                />
            </div>
        </form>

        {/* Modal de Cambio de Contraseña (Admin) */}
        {showPassModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[210] p-4">
                <div className="bg-white p-6 rounded-3xl w-full max-w-xs shadow-2xl animate-in zoom-in-95">
                    <h4 className="text-sm font-black text-blue-950 uppercase tracking-tight mb-4">Cambiar Contraseña</h4>
                    <input 
                        type="password" 
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        placeholder="Nueva contraseña"
                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold mb-4 outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="flex gap-2">
                        <ActionButton 
                            onClick={() => setShowPassModal(false)} 
                            label="Cancelar"
                            variant="secondary"
                            className="flex-1 !py-2 !text-xs !font-bold"
                        />
                        <ActionButton 
                            onClick={async () => {
                                if (newPass && employeeData && onAdminSetPassword) {
                                    await onAdminSetPassword(employeeData.id, newPass);
                                    setShowPassModal(false);
                                    setNewPass('');
                                }
                            }}
                            label="Cambiar"
                            variant="primary"
                            className="flex-1 !py-2 !text-xs !font-black"
                        />
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>,
    document.body
  );
};
