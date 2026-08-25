import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Employee, PayStub, Fortnight, CustomPaystubField } from '../financeTypes';
import { User } from '../utils/types';
import { canGeneratePaystub } from '../utils/paystubValidation';
import { FiX, FiAlertCircle, FiSave, FiDollarSign, FiPlus, FiTrash2 } from "react-icons/fi";
import { ActionButton, IconButton, Select, ConfirmModal } from '../design-system';
import useLockBodyScroll from '../hooks/useLockBodyScroll';

const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.split(' ').map(word => {
        if (!word) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
};

import { AutomaticAdjustment } from './finance/automatic_adjustments/automaticAdjustments.types';

interface PaystubModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: any, id?: string) => Promise<void>;
  employees: Employee[];
  currentUser: User;
  payStubs: PayStub[];
  payStubToEdit?: PayStub | null;
  automaticAdjustments?: AutomaticAdjustment[];
  updateEmployee?: (data: Partial<Employee>, id?: string) => Promise<{ success: boolean; message?: string; }>;
}

export const PaystubModal: React.FC<PaystubModalProps> = ({ 
    show, onClose, onSubmit, employees, currentUser, payStubs, payStubToEdit, automaticAdjustments = [], updateEmployee
}) => {
  useLockBodyScroll(show);

  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [fortnight, setFortnight] = useState<Fortnight>('Primera');
  
  const [ordinaryHours, setOrdinaryHours] = useState('150');
  const [extraHoursCount, setExtraHoursCount] = useState('0');
  const [holidayHoursCount, setHolidayHoursCount] = useState('0');
  const [bonuses, setBonuses] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');
  const [legalEmbargos, setLegalEmbargos] = useState('');
  const [travelExpenses, setTravelExpenses] = useState('');
  const [availabilityBonus, setAvailabilityBonus] = useState('');
  
  const [customFields, setCustomFields] = useState<CustomPaystubField[]>([]);
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configSalaryDivisor, setConfigSalaryDivisor] = useState('300');
  const [configOrdinaryMultiplier, setConfigOrdinaryMultiplier] = useState('1');
  const [configExtraMultiplier, setConfigExtraMultiplier] = useState('1.5');
  const [configHolidayMultiplier, setConfigHolidayMultiplier] = useState('2');
  const [configExtraValueStr, setConfigExtraValueStr] = useState('');
  const [configHolidayValueStr, setConfigHolidayValueStr] = useState('');
  const [configBaseSalary, setConfigBaseSalary] = useState('');
  const [configReportadoCCSS, setConfigReportadoCCSS] = useState('');
  const [configCcssType, setConfigCcssType] = useState<'percentage' | 'fixed'>('percentage');
  const [configCcssPercentage, setConfigCcssPercentage] = useState('10.83');
  const [configCcssFixedAmount, setConfigCcssFixedAmount] = useState('');
  const [configCcssDivideByTwo, setConfigCcssDivideByTwo] = useState(true);

  // Manual overrides for Valor Hora Base and Valor Hora Ordinaria
  const [isManualValHoraBase, setIsManualValHoraBase] = useState(false);
  const [manualValHoraBaseNum, setManualValHoraBaseNum] = useState<number | null>(null);
  const [configValHoraBaseStr, setConfigValHoraBaseStr] = useState('');
  const [prevValHoraBaseStr, setPrevValHoraBaseStr] = useState('');
  const [showValHoraBaseConfirm1, setShowValHoraBaseConfirm1] = useState(false);
  const [showValHoraBaseConfirm2, setShowValHoraBaseConfirm2] = useState(false);
  const [pendingValHoraBase, setPendingValHoraBase] = useState<number | null>(null);

  const [isManualValHoraOrg, setIsManualValHoraOrg] = useState(false);
  const [manualValHoraOrgNum, setManualValHoraOrgNum] = useState<number | null>(null);
  const [configValHoraOrgStr, setConfigValHoraOrgStr] = useState('');
  const [prevValHoraOrgStr, setPrevValHoraOrgStr] = useState('');
  const [showValHoraOrgConfirm1, setShowValHoraOrgConfirm1] = useState(false);
  const [showValHoraOrgConfirm2, setShowValHoraOrgConfirm2] = useState(false);
  const [pendingValHoraOrg, setPendingValHoraOrg] = useState<number | null>(null);

  const [isManualValHoraRecargos, setIsManualValHoraRecargos] = useState(false);
  const [manualValHoraRecargosNum, setManualValHoraRecargosNum] = useState<number | null>(null);
  const [configValHoraRecargosStr, setConfigValHoraRecargosStr] = useState('');
  const [prevValHoraRecargosStr, setPrevValHoraRecargosStr] = useState('');
  const [showValHoraRecargosConfirm1, setShowValHoraRecargosConfirm1] = useState(false);
  const [showValHoraRecargosConfirm2, setShowValHoraRecargosConfirm2] = useState(false);
  const [pendingValHoraRecargos, setPendingValHoraRecargos] = useState<number | null>(null);
  
  const [showSalaryConfirmModal1, setShowSalaryConfirmModal1] = useState(false);
  const [showSalaryConfirmModal2, setShowSalaryConfirmModal2] = useState(false);
  const [showCcssConfirmModal, setShowCcssConfirmModal] = useState(false);
  const [showBulkConfirmModal1, setShowBulkConfirmModal1] = useState(false);
  const [showBulkConfirmModal2, setShowBulkConfirmModal2] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const isAdminRole = currentUser.role === 'admin';

  // Compute calculated amounts dynamically
  const selectedEmployee = useMemo(() => employees.find(e => e.id === employeeId), [employees, employeeId]);
  
  const salaryConfig = useMemo(() => {
    return selectedEmployee?.salaryConfiguration || {
      salaryDivisor: 300,
      ordinaryMultiplier: 1,
      extraHours: 0,
      extraMultiplier: 1.5,
      holidayHours: 0,
      holidayMultiplier: 2
    };
  }, [selectedEmployee]);


  const parsedConfigBaseSalary = parseFloat(configBaseSalary) || 0;
  const autoValHoraBase = parsedConfigBaseSalary / (parseFloat(configSalaryDivisor) || 300);
  const configValHoraBase = (isManualValHoraBase && manualValHoraBaseNum !== null)
    ? manualValHoraBaseNum
    : autoValHoraBase;

  const autoValHoraOrg = configValHoraBase * (parseFloat(configOrdinaryMultiplier) || 1);
  const configValHoraOrg = (isManualValHoraOrg && manualValHoraOrgNum !== null)
    ? manualValHoraOrgNum
    : autoValHoraOrg;

  const autoValHoraRecargos = configValHoraBase;
  const configValHoraRecargos = (isManualValHoraRecargos && manualValHoraRecargosNum !== null)
    ? manualValHoraRecargosNum
    : autoValHoraRecargos;

  const configValHoraExt = configValHoraRecargos * (parseFloat(configExtraMultiplier) || 1.5);
  const configValHoraFeriado = configValHoraRecargos * (parseFloat(configHolidayMultiplier) || 2);

  const parsedReportado = parseFloat(configReportadoCCSS) || 0;
  const parsedPercentage = parseFloat(configCcssPercentage) || 0;
  const parsedFixed = parseFloat(configCcssFixedAmount) || 0;

  const calculatedCcssMonthly = configCcssType === 'percentage' 
    ? (parsedReportado * parsedPercentage / 100) 
    : parsedFixed;
  
  const calculatedCcssFortnightly = configCcssDivideByTwo 
    ? calculatedCcssMonthly / 2 
    : calculatedCcssMonthly;

  const handleOpenConfigModal = () => {
    if (selectedEmployee) {
      const config = selectedEmployee.salaryConfiguration || {};
      setConfigSalaryDivisor((config.salaryDivisor ?? 300).toString());
      setConfigOrdinaryMultiplier((config.ordinaryMultiplier ?? 1).toString());
      setConfigExtraMultiplier((config.extraMultiplier ?? 1.5).toString());
      setConfigHolidayMultiplier((config.holidayMultiplier ?? 2).toString());
      
      const baseSal = selectedEmployee.baseSalary || 0;
      const divisor = config.salaryDivisor || 300;
      const autoBase = baseSal / divisor;

      const hasManualBase = Boolean(config.isManualValHoraBase && typeof config.manualValHoraBase === 'number');
      const activeBase = hasManualBase ? config.manualValHoraBase! : autoBase;
      setIsManualValHoraBase(hasManualBase);
      setManualValHoraBaseNum(hasManualBase ? config.manualValHoraBase! : null);
      setConfigValHoraBaseStr(activeBase.toFixed(2));
      setPrevValHoraBaseStr(activeBase.toFixed(2));

      const autoOrg = activeBase * (config.ordinaryMultiplier ?? 1);
      const hasManualOrg = Boolean(config.isManualValHoraOrg && typeof config.manualValHoraOrg === 'number');
      const activeOrg = hasManualOrg ? config.manualValHoraOrg! : autoOrg;
      setIsManualValHoraOrg(hasManualOrg);
      setManualValHoraOrgNum(hasManualOrg ? config.manualValHoraOrg! : null);
      setConfigValHoraOrgStr(activeOrg.toFixed(2));
      setPrevValHoraOrgStr(activeOrg.toFixed(2));

      const autoRecargos = activeBase;
      const hasManualRecargos = Boolean(config.isManualValHoraRecargos && typeof config.manualValHoraRecargos === 'number');
      const activeRecargos = hasManualRecargos ? config.manualValHoraRecargos! : autoRecargos;
      setIsManualValHoraRecargos(hasManualRecargos);
      setManualValHoraRecargosNum(hasManualRecargos ? config.manualValHoraRecargos! : null);
      setConfigValHoraRecargosStr(activeRecargos.toFixed(2));
      setPrevValHoraRecargosStr(activeRecargos.toFixed(2));

      setConfigExtraValueStr((activeRecargos * (config.extraMultiplier ?? 1.5)).toFixed(2));
      setConfigHolidayValueStr((activeRecargos * (config.holidayMultiplier ?? 2)).toFixed(2));
      
      setConfigBaseSalary(baseSal.toString());
      setConfigReportadoCCSS((selectedEmployee.reportadoCCSS || baseSal).toString());
      setConfigCcssType(config.ccssType || 'percentage');
      setConfigCcssPercentage((config.ccssPercentage ?? 10.83).toString());
      setConfigCcssFixedAmount((selectedEmployee.ccssDeduction || 0).toString());
      setConfigCcssDivideByTwo(config.ccssDivideByTwo ?? true);
    }
    setShowConfigModal(true);
  };

  const handleConfigExtraMultiplierChange = (val: string) => {
    setConfigExtraMultiplier(val);
    const m = parseFloat(val) || 0;
    setConfigExtraValueStr((configValHoraRecargos * m).toFixed(2));
  };
  
  const handleConfigExtraValueChange = (val: string) => {
    setConfigExtraValueStr(val);
    const v = parseFloat(val) || 0;
    if (configValHoraRecargos > 0) {
      setConfigExtraMultiplier((v / configValHoraRecargos).toString());
    }
  };

  const handleConfigHolidayMultiplierChange = (val: string) => {
    setConfigHolidayMultiplier(val);
    const m = parseFloat(val) || 0;
    setConfigHolidayValueStr((configValHoraRecargos * m).toFixed(2));
  };
  
  const handleConfigHolidayValueChange = (val: string) => {
    setConfigHolidayValueStr(val);
    const v = parseFloat(val) || 0;
    if (configValHoraRecargos > 0) {
      setConfigHolidayMultiplier((v / configValHoraRecargos).toString());
    }
  };

  // Update values if base salary or divisor change when NOT manually overridden
  useEffect(() => {
    if (showConfigModal) {
      if (!isManualValHoraBase) {
        const str = autoValHoraBase.toFixed(2);
        setConfigValHoraBaseStr(str);
        setPrevValHoraBaseStr(str);
      }
      if (!isManualValHoraOrg) {
        const str = autoValHoraOrg.toFixed(2);
        setConfigValHoraOrgStr(str);
        setPrevValHoraOrgStr(str);
      }
      if (!isManualValHoraRecargos) {
        const str = autoValHoraRecargos.toFixed(2);
        setConfigValHoraRecargosStr(str);
        setPrevValHoraRecargosStr(str);
      }
      if (configValHoraRecargos > 0) {
        setConfigExtraValueStr((configValHoraRecargos * (parseFloat(configExtraMultiplier) || 0)).toFixed(2));
        setConfigHolidayValueStr((configValHoraRecargos * (parseFloat(configHolidayMultiplier) || 0)).toFixed(2));
      }
    }
  }, [configValHoraBase, configValHoraRecargos, showConfigModal, isManualValHoraBase, isManualValHoraOrg, isManualValHoraRecargos, autoValHoraBase, autoValHoraOrg, autoValHoraRecargos, configExtraMultiplier, configHolidayMultiplier]);

  const handleValHoraBaseBlur = () => {
    const currentVal = parseFloat(configValHoraBaseStr);
    const currentActive = isManualValHoraBase && manualValHoraBaseNum !== null
      ? manualValHoraBaseNum
      : autoValHoraBase;

    if (!isNaN(currentVal) && Math.abs(currentVal - currentActive) > 0.001) {
      setPendingValHoraBase(currentVal);
      setShowValHoraBaseConfirm1(true);
    } else if (isNaN(currentVal)) {
      setConfigValHoraBaseStr(currentActive.toFixed(2));
    }
  };

  const handleCancelValHoraBaseConfirm = () => {
    setShowValHoraBaseConfirm1(false);
    setShowValHoraBaseConfirm2(false);
    setPendingValHoraBase(null);
    setConfigValHoraBaseStr(prevValHoraBaseStr);
  };

  const handleConfirmValHoraBase1 = () => {
    setShowValHoraBaseConfirm1(false);
    setShowValHoraBaseConfirm2(true);
  };

  const handleConfirmValHoraBase2 = () => {
    if (pendingValHoraBase !== null) {
      setIsManualValHoraBase(true);
      setManualValHoraBaseNum(pendingValHoraBase);
      const str = pendingValHoraBase.toFixed(2);
      setConfigValHoraBaseStr(str);
      setPrevValHoraBaseStr(str);

      if (!isManualValHoraOrg) {
        const newOrg = pendingValHoraBase * (parseFloat(configOrdinaryMultiplier) || 1);
        setConfigValHoraOrgStr(newOrg.toFixed(2));
        setPrevValHoraOrgStr(newOrg.toFixed(2));
      }
      setConfigExtraValueStr((pendingValHoraBase * (parseFloat(configExtraMultiplier) || 1.5)).toFixed(2));
      setConfigHolidayValueStr((pendingValHoraBase * (parseFloat(configHolidayMultiplier) || 2)).toFixed(2));
    }
    setShowValHoraBaseConfirm2(false);
    setPendingValHoraBase(null);
  };

  const handleResetValHoraBase = () => {
    setIsManualValHoraBase(false);
    setManualValHoraBaseNum(null);
    const str = autoValHoraBase.toFixed(2);
    setConfigValHoraBaseStr(str);
    setPrevValHoraBaseStr(str);
  };

  const handleValHoraOrgBlur = () => {
    const currentVal = parseFloat(configValHoraOrgStr);
    const currentActive = isManualValHoraOrg && manualValHoraOrgNum !== null
      ? manualValHoraOrgNum
      : autoValHoraOrg;

    if (!isNaN(currentVal) && Math.abs(currentVal - currentActive) > 0.001) {
      setPendingValHoraOrg(currentVal);
      setShowValHoraOrgConfirm1(true);
    } else if (isNaN(currentVal)) {
      setConfigValHoraOrgStr(currentActive.toFixed(2));
    }
  };

  const handleCancelValHoraOrgConfirm = () => {
    setShowValHoraOrgConfirm1(false);
    setShowValHoraOrgConfirm2(false);
    setPendingValHoraOrg(null);
    setConfigValHoraOrgStr(prevValHoraOrgStr);
  };

  const handleConfirmValHoraOrg1 = () => {
    setShowValHoraOrgConfirm1(false);
    setShowValHoraOrgConfirm2(true);
  };

  const handleConfirmValHoraOrg2 = () => {
    if (pendingValHoraOrg !== null) {
      setIsManualValHoraOrg(true);
      setManualValHoraOrgNum(pendingValHoraOrg);
      const str = pendingValHoraOrg.toFixed(2);
      setConfigValHoraOrgStr(str);
      setPrevValHoraOrgStr(str);
    }
    setShowValHoraOrgConfirm2(false);
    setPendingValHoraOrg(null);
  };

  const handleResetValHoraOrg = () => {
    setIsManualValHoraOrg(false);
    setManualValHoraOrgNum(null);
    const str = autoValHoraOrg.toFixed(2);
    setConfigValHoraOrgStr(str);
    setPrevValHoraOrgStr(str);
  };

  const handleValHoraRecargosBlur = () => {
    const currentVal = parseFloat(configValHoraRecargosStr);
    const currentActive = isManualValHoraRecargos && manualValHoraRecargosNum !== null
      ? manualValHoraRecargosNum
      : autoValHoraRecargos;

    if (!isNaN(currentVal) && Math.abs(currentVal - currentActive) > 0.001) {
      setPendingValHoraRecargos(currentVal);
      setShowValHoraRecargosConfirm1(true);
    } else if (isNaN(currentVal)) {
      setConfigValHoraRecargosStr(currentActive.toFixed(2));
    }
  };

  const handleCancelValHoraRecargosConfirm = () => {
    setShowValHoraRecargosConfirm1(false);
    setShowValHoraRecargosConfirm2(false);
    setPendingValHoraRecargos(null);
    setConfigValHoraRecargosStr(prevValHoraRecargosStr);
  };

  const handleConfirmValHoraRecargos1 = () => {
    setShowValHoraRecargosConfirm1(false);
    setShowValHoraRecargosConfirm2(true);
  };

  const handleConfirmValHoraRecargos2 = () => {
    if (pendingValHoraRecargos !== null) {
      setIsManualValHoraRecargos(true);
      setManualValHoraRecargosNum(pendingValHoraRecargos);
      const str = pendingValHoraRecargos.toFixed(2);
      setConfigValHoraRecargosStr(str);
      setPrevValHoraRecargosStr(str);

      setConfigExtraValueStr((pendingValHoraRecargos * (parseFloat(configExtraMultiplier) || 1.5)).toFixed(2));
      setConfigHolidayValueStr((pendingValHoraRecargos * (parseFloat(configHolidayMultiplier) || 2)).toFixed(2));
    }
    setShowValHoraRecargosConfirm2(false);
    setPendingValHoraRecargos(null);
  };

  const handleResetValHoraRecargos = () => {
    setIsManualValHoraRecargos(false);
    setManualValHoraRecargosNum(null);
    const str = autoValHoraRecargos.toFixed(2);
    setConfigValHoraRecargosStr(str);
    setPrevValHoraRecargosStr(str);
  };

const handleBaseSalaryBlur = () => {
    if (!selectedEmployee) return;
    const isSalaryChanged = parsedConfigBaseSalary !== (selectedEmployee.baseSalary || 0);
    if (isSalaryChanged) {
      setShowSalaryConfirmModal1(true);
    }
  };

  const handleReportadoCCSSBlur = () => {
    if (!selectedEmployee) return;
    const isReportadoChanged = parsedReportado !== (selectedEmployee.reportadoCCSS || selectedEmployee.baseSalary || 0);
    if (isReportadoChanged) {
      setShowCcssConfirmModal(true);
    }
  };

  const executeSaveConfig = async () => {
    if (!selectedEmployee || !updateEmployee) return;
    try {
      await updateEmployee({
        ccssDeduction: calculatedCcssMonthly,
        ccssDeductionQuincenal: calculatedCcssFortnightly,
        salaryConfiguration: {
          salaryDivisor: parseFloat(configSalaryDivisor) || 300,
          ordinaryMultiplier: parseFloat(configOrdinaryMultiplier) || 1,
          extraHours: parseFloat(extraHoursCount) || 0,
          extraMultiplier: parseFloat(configExtraMultiplier) || 1.5,
          holidayHours: parseFloat(holidayHoursCount) || 0,
          holidayMultiplier: parseFloat(configHolidayMultiplier) || 2,
          ccssType: configCcssType,
          ccssPercentage: parsedPercentage,
          ccssDivideByTwo: configCcssDivideByTwo,
          isManualValHoraBase: isManualValHoraBase,
          manualValHoraBase: isManualValHoraBase ? (manualValHoraBaseNum ?? undefined) : undefined,
          isManualValHoraOrg: isManualValHoraOrg,
          manualValHoraOrg: isManualValHoraOrg ? (manualValHoraOrgNum ?? undefined) : undefined,
          isManualValHoraRecargos: isManualValHoraRecargos,
          manualValHoraRecargos: isManualValHoraRecargos ? (manualValHoraRecargosNum ?? undefined) : undefined,
        }
      }, selectedEmployee.id);
      setShowConfigModal(false);
      setShowSalaryConfirmModal1(false);
      setShowSalaryConfirmModal2(false);
      setShowCcssConfirmModal(false);
      setShowValHoraBaseConfirm1(false);
      setShowValHoraBaseConfirm2(false);
      setShowValHoraOrgConfirm1(false);
      setShowValHoraOrgConfirm2(false);
    } catch (err) {
      console.error("Error saving config:", err);
      alert("Error al guardar la configuración.");
    }
  };

  const handleSaveConfig = () => {
    executeSaveConfig();
  };

  const executeBulkApplyConfig = async () => {
    if (!updateEmployee || !employees || employees.length === 0) return;
    setIsBulkSubmitting(true);
    try {
      const newSalaryConfig = {
        salaryDivisor: parseFloat(configSalaryDivisor) || 300,
        ordinaryMultiplier: parseFloat(configOrdinaryMultiplier) || 1,
        extraHours: parseFloat(extraHoursCount) || 0,
        extraMultiplier: parseFloat(configExtraMultiplier) || 1.5,
        holidayHours: parseFloat(holidayHoursCount) || 0,
        holidayMultiplier: parseFloat(configHolidayMultiplier) || 2,
        ccssType: configCcssType,
        ccssPercentage: parsedPercentage,
        ccssDivideByTwo: configCcssDivideByTwo,
        isManualValHoraBase: isManualValHoraBase,
        manualValHoraBase: isManualValHoraBase ? (manualValHoraBaseNum ?? undefined) : undefined,
        isManualValHoraOrg: isManualValHoraOrg,
        manualValHoraOrg: isManualValHoraOrg ? (manualValHoraOrgNum ?? undefined) : undefined,
        isManualValHoraRecargos: isManualValHoraRecargos,
        manualValHoraRecargos: isManualValHoraRecargos ? (manualValHoraRecargosNum ?? undefined) : undefined,
      };

      let successCount = 0;
      for (const emp of employees) {
        if (emp.id) {
          // Calculate CCSS individually using each employee's own salary data
          const empReportado = emp.reportadoCCSS || emp.baseSalary || 0;
          let empCcssDeduction = emp.ccssDeduction || 0;

          if (configCcssType === 'percentage') {
            empCcssDeduction = (empReportado * parsedPercentage) / 100;
          }

          const empCcssDeductionQuincenal = configCcssDivideByTwo
            ? empCcssDeduction / 2
            : empCcssDeduction;

          const employeeUpdateData = {
            ccssDeduction: empCcssDeduction,
            ccssDeductionQuincenal: empCcssDeductionQuincenal,
            salaryConfiguration: newSalaryConfig,
          };

          const res = await updateEmployee(employeeUpdateData, emp.id);
          if (res && res.success !== false) {
            successCount++;
          }
        }
      }

      setShowBulkConfirmModal2(false);
      setShowBulkConfirmModal1(false);
      setShowConfigModal(false);
      alert(`Configuración aplicada correctamente a ${successCount} colaboradores.`);
    } catch (err) {
      console.error("Error al aplicar configuración masiva:", err);
      alert("Error al aplicar la configuración a todos los colaboradores.");
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const valHoraBase = selectedEmployee
    ? (salaryConfig.isManualValHoraBase && typeof salaryConfig.manualValHoraBase === 'number'
        ? salaryConfig.manualValHoraBase
        : (selectedEmployee.baseSalary || 0) / (salaryConfig.salaryDivisor || 300))
    : 0;

  const valHoraOrg = selectedEmployee
    ? (salaryConfig.isManualValHoraOrg && typeof salaryConfig.manualValHoraOrg === 'number'
        ? salaryConfig.manualValHoraOrg
        : valHoraBase * (salaryConfig.ordinaryMultiplier || 1))
    : 0;

  const valHoraRecargos = selectedEmployee
    ? (salaryConfig.isManualValHoraRecargos && typeof salaryConfig.manualValHoraRecargos === 'number'
        ? salaryConfig.manualValHoraRecargos
        : valHoraBase)
    : 0;

  const valHoraExt = valHoraRecargos * (salaryConfig.extraMultiplier || 1.5);
  const valHoraFeriado = valHoraRecargos * (salaryConfig.holidayMultiplier || 2);

  const currentOrdinaryHours = ordinaryHours ? parseFloat(ordinaryHours) : 0;
  const currentExtraHoursCount = extraHoursCount ? parseFloat(extraHoursCount) : 0;
  const currentHolidayHoursCount = holidayHoursCount ? parseFloat(holidayHoursCount) : 0;
  const currentBonuses = bonuses ? parseFloat(bonuses) : 0;
  const currentAdvancePayment = advancePayment ? parseFloat(advancePayment) : 0;
  const currentLegalEmbargos = legalEmbargos ? parseFloat(legalEmbargos) : 0;
  const currentTravelExpenses = travelExpenses ? parseFloat(travelExpenses) : 0;
  const currentAvailabilityBonus = availabilityBonus ? parseFloat(availabilityBonus) : 0;

  const computedOrdinarySalary = Math.round(valHoraOrg * currentOrdinaryHours * 100) / 100;
  const computedExtraSalary = Math.round(valHoraExt * currentExtraHoursCount * 100) / 100;
  const computedHolidaySalary = Math.round(valHoraFeriado * currentHolidayHoursCount * 100) / 100;

  useEffect(() => {
    if (show && !payStubToEdit && selectedEmployee) {
      const config = selectedEmployee.salaryConfiguration;
      setExtraHoursCount(config?.extraHours?.toString() || '0');
      setHolidayHoursCount(config?.holidayHours?.toString() || '0');
    }
  }, [selectedEmployee, payStubToEdit, show]);

  const employeeOptions = useMemo(() => {
    return employees
      .filter(emp => {
          const isValid = emp.status === 'activo' && emp.name && emp.email && emp.employeeCode;
          if (!isAdminRole) {
              return isValid && emp.email === currentUser.email;
          }
          return isValid;
      })
      .map(emp => ({
        label: `${emp.name} (${emp.employeeCode})`,
        value: emp.id
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [employees, isAdminRole, currentUser.email]);

  const initializedRef = React.useRef<{ show: boolean, editId: string | null | undefined }>({ show: false, editId: undefined });

  useEffect(() => {
    const currentEditId = payStubToEdit ? payStubToEdit.id : null;
    // Only initialize when show transitions to true OR payStubToEdit changes
    if (show && (!initializedRef.current.show || initializedRef.current.editId !== currentEditId)) {
        if (payStubToEdit) {
            setEmployeeId(payStubToEdit.employeeId);
            setYear(payStubToEdit.year);
            setMonth(payStubToEdit.month);
            setFortnight(payStubToEdit.fortnight);
            setOrdinaryHours((payStubToEdit.ordinaryHours || 0).toString());
            setExtraHoursCount((payStubToEdit.extraHoursCount || 0).toString());
            setHolidayHoursCount((payStubToEdit.holidayHoursCount || 0).toString());
            setBonuses((payStubToEdit.bonuses || 0).toString());
            setAdvancePayment((payStubToEdit.advancePayment || 0).toString());
            setLegalEmbargos((payStubToEdit.legalEmbargos || 0).toString() || '');
            setTravelExpenses((payStubToEdit.travelExpenses || 0).toString());
            setAvailabilityBonus((payStubToEdit.availabilityBonus || 0).toString());
            setCustomFields(payStubToEdit.customFields || []);
        } else if (isAdminRole) {
            setEmployeeId('');
            setYear(new Date().getFullYear());
            setMonth(new Date().getMonth() + 1);
            setFortnight(new Date().getDate() <= 15 ? 'Primera' : 'Segunda');
            setOrdinaryHours('150');
            setExtraHoursCount('0');
            setHolidayHoursCount('0');
            setBonuses('');
            setAdvancePayment('');
            setLegalEmbargos('');
            setTravelExpenses('');
            setAvailabilityBonus('');
            setCustomFields([]);
        } else {
            const me = employees.find(e => e.email === currentUser.email);
            if (me) {
                setEmployeeId(me.id);
            }
            setYear(new Date().getFullYear());
            setMonth(new Date().getMonth() + 1);
            setFortnight(new Date().getDate() <= 15 ? 'Primera' : 'Segunda');
            setOrdinaryHours('150');
            setExtraHoursCount('0');
            setHolidayHoursCount('0');
            setBonuses('');
            setAdvancePayment('');
            setLegalEmbargos('');
            setTravelExpenses('');
            setAvailabilityBonus('');
            setCustomFields([]);
        }
        setError(null);
        initializedRef.current = { show: true, editId: currentEditId };
    } else if (!show && initializedRef.current.show) {
        initializedRef.current = { show: false, editId: undefined };
    }
  }, [show, employees, currentUser, isAdminRole, payStubToEdit]);

  useEffect(() => {
     if (show && !payStubToEdit && employeeId && year && month && fortnight) {
         // Determine if there are active automatic adjustments for this employee and period
         const dateOfStub = new Date(year, month - 1, fortnight === 'Primera' ? 15 : 28);
         
         const activeAdjustments = automaticAdjustments.filter(adj => {
             if (adj.employeeId !== employeeId) return false;
             if (adj.status !== 'activo') return false;
             if (adj.pendingBalance <= 0) return false;
             
             const startDateObj = new Date(adj.startDate);
             if (dateOfStub < startDateObj) return false;
             
             if (adj.endDate) {
                 const endDateObj = new Date(adj.endDate);
                 if (dateOfStub > endDateObj) return false;
             }
             
             return true;
         });

         const newCustomFields = activeAdjustments.map(adj => {
             let amountToApply = adj.fortnightlyQuota;
             if (adj.pendingBalance < amountToApply) {
                 amountToApply = adj.pendingBalance;
             }

             return {
                 id: "auto_" + adj.id,
                 type: adj.type,
                 name: adj.conceptName,
                 amount: amountToApply,
                 isAutomatic: true,
                 automaticAdjustmentId: adj.id,
                 comment: adj.comment
             };
         });

         // Only update customFields if we have active adjustments and haven't already added them
         setCustomFields(prev => {
             const manualFields = prev.filter(f => !f.isAutomatic);
             // Prevent infinite re-renders or duplicating
             return [...manualFields, ...newCustomFields];
         });
     }
  }, [employeeId, year, month, fortnight, show, payStubToEdit, automaticAdjustments]);

  const addCustomField = () => {
      if (!isAdminRole) return;
      setCustomFields([...customFields, { id: Math.random().toString(36).substr(2, 9), type: 'ingreso', name: '', amount: 0 }]);
  };

  const updateCustomField = (id: string, key: keyof CustomPaystubField, value: any) => {
      if (!isAdminRole) return;
      setCustomFields(customFields.map(cf => cf.id === id ? { ...cf, [key]: value } : cf));
  };

  const removeCustomField = (id: string) => {
      if (!isAdminRole) return;
      setCustomFields(customFields.filter(cf => cf.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!employeeId || !year || !month || !fortnight) {
        setError("Los campos marcados con * son obligatorios.");
        return;
    }

    // Verificar si ya existe una colilla para este periodo, pero permitir si es la misma que estamos editando
    const exists = payStubs.some(p => 
        p.employeeId === employeeId && 
        p.year === year && 
        p.month === month && 
        p.fortnight === fortnight &&
        (!payStubToEdit || p.id !== payStubToEdit.id)
    );

    if (exists) {
        setError("Ya existe una colilla generada para este colaborador en el periodo seleccionado.");
        return;
    }

    // --- VALIDACIÓN EMPRESARIAL TEMPORAL ---
    const validation = canGeneratePaystub(year, month, fortnight);
    if (!validation.allowed) {
        setError(`${validation.message}\n\n${validation.details || ''}`);
        return;
    }
    // ----------------------------------------

    setIsSubmitting(true);
    try {
        const payload = {
            creatorId: currentUser.id,
            createdByRole: currentUser.role,
            employeeId,
            employeeEmail: employees.find(e => e.id === employeeId)?.email || '',
            year,
            month,
            fortnight,
            ordinaryHours: currentOrdinaryHours,
            extraHoursCount: currentExtraHoursCount,
            extraHours: computedExtraSalary,
            baseSalary: computedOrdinarySalary,
            holidayHoursCount: currentHolidayHoursCount,
            holidays: computedHolidaySalary,
            bonuses: bonuses ? parseFloat(bonuses) : 0,
            advancePayment: advancePayment ? parseFloat(advancePayment) : 0,
            legalEmbargos: legalEmbargos ? parseFloat(legalEmbargos) : 0,
            travelExpenses: travelExpenses ? parseFloat(travelExpenses) : 0,
            availabilityBonus: availabilityBonus ? parseFloat(availabilityBonus) : 0,
            customFields
        };

        if (payStubToEdit) {
            await onSubmit(payload, payStubToEdit.id);
        } else {
            await onSubmit(payload);
        }
        onClose();
    } catch (err: any) {
        setError(err.message || "Error al guardar la colilla.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4 sm:p-6">
      <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-[32px] flex-none">
                <div>
                    <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                        {payStubToEdit ? 'Editar Colilla' : 'Generar Colilla'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cálculo de Nómina</p>
                </div>
                <IconButton 
                    variant="neutral" 
                    icon={<FiX />} 
                    onClick={onClose} 
                    title="Cerrar"
                />
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar bg-white">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Colaborador */}
                    <div className="col-span-1 sm:col-span-2 md:grid-cols-3">
                                                <Select
                            label="Colaborador *"
                            options={employeeOptions}
                            value={employeeId}
                            onChange={setEmployeeId}
                            placeholder="-- Seleccione Colaborador --"
                            isSearchable={isAdminRole}
                            disabled={!isAdminRole}
                        />
                        {selectedEmployee && updateEmployee && isAdminRole && (
                            <div className="mt-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleOpenConfigModal}
                                    className="text-[11px] flex items-center gap-1 text-slate-500 hover:text-slate-700 font-bold transition-colors uppercase tracking-wide"
                                >
                                    <span>⚙️</span> CONFIGURACIÓN DEL CÁLCULO
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Periodo */}
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Año *</label>
                        <select
                            value={year}
                            onChange={e => setYear(parseInt(e.target.value))}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Mes *</label>
                        <select
                            value={month}
                            onChange={e => setMonth(parseInt(e.target.value))}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            {monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                    </div>

                    <div className="col-span-1 sm:col-span-2 md:col-span-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Quincena *</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <ActionButton 
                                type="button"
                                label="Primera (1-15)"
                                onClick={() => setFortnight('Primera')}
                                variant={fortnight === 'Primera' ? 'primary' : 'secondary'}
                                className={`!flex-1 !py-2 !text-[10px] !font-black !uppercase !rounded-lg !transition-all ${fortnight === 'Primera' ? '!bg-white !text-blue-900 !shadow-md' : '!bg-transparent !text-slate-400 hover:!text-slate-600'}`}
                            />
                            <ActionButton 
                                type="button"
                                label="Segunda (16-Fin)"
                                onClick={() => setFortnight('Segunda')}
                                variant={fortnight === 'Segunda' ? 'primary' : 'secondary'}
                                className={`!flex-1 !py-2 !text-[10px] !font-black !uppercase !rounded-lg !transition-all ${fortnight === 'Segunda' ? '!bg-white !text-blue-900 !shadow-md' : '!bg-transparent !text-slate-400 hover:!text-slate-600'}`}
                            />
                        </div>
                    </div>

                    {/* Advertencia de Periodo Futuro */}
                    {(() => {
                        const v = canGeneratePaystub(year, month, fortnight);
                        if (!v.allowed && !error) {
                            return (
                                <div className="col-span-1 sm:col-span-2 md:col-span-3 bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-2 shadow-sm animate-in fade-in slide-in-from-top-1">
                                    <FiAlertCircle className="text-amber-500 mt-0.5 shrink-0" size={16} />
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-tight">{v.message}</p>
                                        <p className="text-[9px] text-amber-600 font-medium leading-tight mt-0.5">{v.details}</p>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div className="col-span-1 sm:col-span-2 md:col-span-3">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 mb-1 flex items-center gap-2">
                            <FiDollarSign className="text-blue-500" /> Ajustes de Nómina
                        </h4>
                    </div>

                    {/* Horas Ordinarias */}
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Horas Ordinarias</label>
                        <input 
                            type="number" 
                            step="0.5"
                            value={ordinaryHours} 
                            onChange={e => setOrdinaryHours(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="150"
                            disabled={!isAdminRole}
                        />
                        {isAdminRole && (
                            <div className="mt-1.5 text-xs font-semibold text-slate-500 transition-all duration-300">
                                ₡{computedOrdinarySalary.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>

                    {/* Horas Extra */}
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Horas Extra</label>
                        <input 
                            type="number" 
                            step="0.5"
                            value={extraHoursCount} 
                            onChange={e => setExtraHoursCount(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0"
                            disabled={!isAdminRole}
                        />
                        {isAdminRole && (
                            <div className="mt-1.5 text-xs font-semibold text-slate-500 transition-all duration-300">
                                ₡{computedExtraSalary.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>

                    {/* Horas Feriado */}
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Horas Feriado</label>
                        <input 
                            type="number" 
                            step="0.5"
                            value={holidayHoursCount} 
                            onChange={e => setHolidayHoursCount(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0"
                            disabled={!isAdminRole}
                        />
                        {isAdminRole && (
                            <div className="mt-1.5 text-xs font-semibold text-slate-500 transition-all duration-300">
                                ₡{computedHolidaySalary.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>
                    
                    {/* Bonificaciones */}
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Bonos / Incentivos</label>
                        <input 
                            type="number" 
                            value={bonuses} 
                            onChange={e => setBonuses(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Adelantos */}
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Adelantos de Salario</label>
                        <input 
                            type="number" 
                            value={advancePayment} 
                            onChange={e => setAdvancePayment(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Embargos Legales */}
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Embargos Legales</label>
                        <input 
                            type="number" 
                            value={legalEmbargos} 
                            onChange={e => setLegalEmbargos(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Viáticos */}
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Viáticos</label>
                        <input 
                            type="number" 
                            value={travelExpenses} 
                            onChange={e => setTravelExpenses(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Disponibilidad */}
                    <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Plus Disponibilidad</label>
                        <input 
                            type="number" 
                            value={availabilityBonus} 
                            onChange={e => setAvailabilityBonus(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Conceptos Personalizados */}
                    <div className="col-span-2">
                        <div className="flex justify-between items-center mt-4 mb-3">
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-4 h-px bg-blue-200"></span> Conceptos Personalizados
                            </h4>
                            {isAdminRole && (
                                <button type="button" onClick={addCustomField} className="text-blue-500 hover:text-blue-700 text-xs font-bold flex items-center gap-1 transition-colors">
                                    <FiPlus /> Nuevo Concepto
                                </button>
                            )}
                        </div>
                        
                        {customFields.length > 0 ? (
                            <div className="space-y-3">
                                {customFields.map((cf) => (
                                    <div key={cf.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <select 
                                            value={cf.type} 
                                            onChange={e => updateCustomField(cf.id, 'type', e.target.value as 'ingreso' | 'deduccion')}
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none w-1/4 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!isAdminRole}
                                        >
                                            <option value="ingreso">Ingreso (+)</option>
                                            <option value="deduccion">Deducción (-)</option>
                                        </select>
                                        <input 
                                            type="text" 
                                            value={cf.name} 
                                            onChange={e => updateCustomField(cf.id, 'name', toTitleCase(e.target.value))}
                                            placeholder="Nombre del concepto"
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!isAdminRole}
                                        />
                                        <input 
                                            type="number" 
                                            value={cf.amount || ''} 
                                            onChange={e => updateCustomField(cf.id, 'amount', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none w-1/4 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!isAdminRole}
                                        />
                                        {isAdminRole && !cf.isAutomatic && (
                                            <button type="button" onClick={() => setFieldToDelete(cf.id)} className="p-2 text-red-500 hover:text-red-700 transition-colors" title="Eliminar Concepto">
                                                <FiTrash2 />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 font-medium italic text-center py-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                No hay conceptos personalizados agregados.
                            </div>
                        )}
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
                    label={payStubToEdit ? "Guardar Cambios" : "Generar Colilla"}
                    icon={<FiSave />}
                    variant="primary"
                    className="flex-1 !py-3 !text-xs !font-black !uppercase !tracking-wider !rounded-xl"
                />
            </div>
        </form>
        <ConfirmModal
            show={!!fieldToDelete}
            onClose={() => setFieldToDelete(null)}
            onConfirm={() => {
                if (fieldToDelete) {
                    removeCustomField(fieldToDelete);
                    setFieldToDelete(null);
                }
            }}
            title="¿Desea eliminar este concepto personalizado?"
            description="Esta acción eliminará el concepto. ¿Deseas continuar?"
            confirmLabel="CONFIRMAR"
            variant="danger"
        />

      </div>
    </div>
    {showConfigModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 md:p-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl lg:max-w-6xl my-auto flex flex-col max-h-[92vh] overflow-hidden border border-slate-100/50">
            <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-none">
              <h3 className="font-bold text-slate-800 text-sm md:text-base tracking-wide uppercase">CONFIGURACIÓN DEL CÁLCULO</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors shadow-sm" title="Cerrar">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              {/* Header Colaborador */}
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Colaborador seleccionado:</p>
                  <p className="text-base font-extrabold text-slate-800">{selectedEmployee?.name}</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-2xs self-start sm:self-auto">
                  <span>Salario base registrado:</span>
                  <span className="font-bold text-slate-900">₡{parsedConfigBaseSalary.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Main Grid: 3 Columns on desktop / 2 on tablet / 1 on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                
                {/* Panel 1: Salario & Horas Ordinarias */}
                <div className="space-y-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2 uppercase tracking-wider flex items-center gap-2">
                      <span>Salario Base</span>
                    </h4>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Salario base actual:</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₡</span>
                        <input type="number" value={configBaseSalary} onChange={e => setConfigBaseSalary(e.target.value)} onBlur={handleBaseSalaryBlur} className="w-full pl-8 pr-3 py-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold text-blue-600 mb-3 border-b border-blue-100 pb-2 uppercase tracking-wider flex items-center gap-2">
                      <span>Horas Ordinarias</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      {/* Campos de Configuración */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Horas base mensuales:</label>
                          <input type="number" value={configSalaryDivisor} onChange={e => setConfigSalaryDivisor(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors p-2" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Multiplicador:</label>
                          <input type="number" step="0.01" value={configOrdinaryMultiplier} onChange={e => setConfigOrdinaryMultiplier(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors p-2" />
                        </div>
                      </div>

                      {/* Tarjeta Resumen / Ajuste Editable al lado */}
                      <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100/80 space-y-3">
                        <div className="flex justify-between items-center border-b border-blue-200/50 pb-1.5">
                          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Valores Hora</span>
                          <span className="text-[10px] font-medium text-slate-500 italic">Editable manual</span>
                        </div>

                        {/* Valor Hora Base */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-700">Valor hora base:</label>
                            {isManualValHoraBase && (
                              <button
                                type="button"
                                onClick={handleResetValHoraBase}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 px-1.5 py-0.5 rounded transition-colors"
                                title="Restaurar cálculo automático"
                              >
                                Autocalcular
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₡</span>
                            <input
                              type="number"
                              step="0.01"
                              value={configValHoraBaseStr}
                              onChange={e => setConfigValHoraBaseStr(e.target.value)}
                              onBlur={handleValHoraBaseBlur}
                              className={`w-full pl-6 pr-2 py-1.5 text-xs font-bold border rounded-lg focus:ring-2 focus:ring-blue-400 bg-white transition-colors ${
                                isManualValHoraBase ? 'border-amber-400 text-amber-900 bg-amber-50/30' : 'border-blue-200 text-slate-800'
                              }`}
                            />
                          </div>
                          {isManualValHoraBase && (
                            <span className="text-[9px] text-amber-700 font-medium block mt-0.5">⚠️ Valor fijado manualmente</span>
                          )}
                        </div>

                        {/* Valor Hora Ordinaria */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-700">Valor hora ordinaria:</label>
                            {isManualValHoraOrg && (
                              <button
                                type="button"
                                onClick={handleResetValHoraOrg}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 px-1.5 py-0.5 rounded transition-colors"
                                title="Restaurar cálculo automático"
                              >
                                Autocalcular
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₡</span>
                            <input
                              type="number"
                              step="0.01"
                              value={configValHoraOrgStr}
                              onChange={e => setConfigValHoraOrgStr(e.target.value)}
                              onBlur={handleValHoraOrgBlur}
                              className={`w-full pl-6 pr-2 py-1.5 text-xs font-bold border rounded-lg focus:ring-2 focus:ring-blue-400 bg-white transition-colors ${
                                isManualValHoraOrg ? 'border-amber-400 text-amber-900 bg-amber-50/30' : 'border-blue-200 text-blue-800'
                              }`}
                            />
                          </div>
                          {isManualValHoraOrg && (
                            <span className="text-[9px] text-amber-700 font-medium block mt-0.5">⚠️ Valor fijado manualmente</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Valor Hora Recargos, Horas Extra, Feriado & Resumen */}
                <div className="space-y-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div>
                    <h4 className="text-[11px] font-bold text-amber-600 mb-3 border-b border-amber-100 pb-2 uppercase tracking-wider flex items-center gap-2">
                      <span>Valor Hora para Recargos</span>
                    </h4>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-slate-700">Valor hora para recargos:</label>
                        {isManualValHoraRecargos && (
                          <button
                            type="button"
                            onClick={handleResetValHoraRecargos}
                            className="text-[10px] font-bold text-amber-600 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-colors"
                            title="Restaurar a valor hora base"
                          >
                            Autocalcular
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₡</span>
                        <input
                          type="number"
                          step="0.01"
                          value={configValHoraRecargosStr}
                          onChange={e => setConfigValHoraRecargosStr(e.target.value)}
                          onBlur={handleValHoraRecargosBlur}
                          className={`w-full pl-7 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-400 bg-slate-50 focus:bg-white transition-colors ${
                            isManualValHoraRecargos ? 'border-amber-400 text-amber-900 bg-amber-50/30' : 'border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>
                      {isManualValHoraRecargos && (
                        <span className="text-[9px] text-amber-700 font-medium block mt-1">⚠️ Valor fijado manualmente</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold text-amber-600 mb-3 border-b border-amber-100 pb-2 uppercase tracking-wider flex items-center gap-2">
                      <span>Horas Extra</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Multiplicador:</label>
                        <input type="number" step="0.01" value={configExtraMultiplier} onChange={e => handleConfigExtraMultiplierChange(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-slate-50 focus:bg-white transition-colors p-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Valor hora extra:</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₡</span>
                          <input type="number" step="0.01" value={configExtraValueStr} onChange={e => handleConfigExtraValueChange(e.target.value)} className="w-full pl-6 pr-2 py-2 text-sm border-slate-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-slate-50 focus:bg-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold text-emerald-600 mb-3 border-b border-emerald-100 pb-2 uppercase tracking-wider flex items-center gap-2">
                      <span>Horas Feriado</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Multiplicador:</label>
                        <input type="number" step="0.01" value={configHolidayMultiplier} onChange={e => handleConfigHolidayMultiplierChange(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors p-2" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Valor hora feriado:</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₡</span>
                          <input type="number" step="0.01" value={configHolidayValueStr} onChange={e => handleConfigHolidayValueChange(e.target.value)} className="w-full pl-6 pr-2 py-2 text-sm border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                    <h4 className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-wider border-b border-slate-200/60 pb-2">Resumen (Auto-calculado)</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Salario base utilizado:</span>
                        <span className="font-bold text-slate-800">₡{parsedConfigBaseSalary.toLocaleString('es-CR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Valor hora base:</span>
                        <span className="font-bold text-slate-800">₡{configValHoraBase.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
                        <span className="text-slate-600">Valor hora ordinaria:</span>
                        <span className="font-bold text-blue-700">₡{configValHoraOrg.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Valor hora para recargos:</span>
                        <span className="font-bold text-amber-800">₡{configValHoraRecargos.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Valor hora extra:</span>
                        <span className="font-bold text-amber-700">₡{configValHoraExt.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Valor hora feriado:</span>
                        <span className="font-bold text-emerald-700">₡{configValHoraFeriado.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel 3: Configuración CCSS & Acción Masiva */}
                <div className="space-y-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs md:col-span-2 lg:col-span-1">
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2 uppercase tracking-wider flex items-center gap-2">
                      <span>Configuración CCSS</span>
                    </h4>
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Salario reportado a CCSS:</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₡</span>
                          <input type="number" value={configReportadoCCSS} onChange={e => setConfigReportadoCCSS(e.target.value)} onBlur={handleReportadoCCSSBlur} className="w-full pl-8 pr-3 py-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipo deducción:</label>
                          <select value={configCcssType} onChange={e => setConfigCcssType(e.target.value as 'percentage'|'fixed')} className="w-full p-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors">
                            <option value="percentage">Porcentaje</option>
                            <option value="fixed">Monto fijo</option>
                          </select>
                        </div>
                        {configCcssType === 'percentage' ? (
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Porcentaje (%):</label>
                            <input type="number" step="0.01" value={configCcssPercentage} onChange={e => setConfigCcssPercentage(e.target.value)} className="w-full p-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Monto fijo:</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₡</span>
                              <input type="number" value={configCcssFixedAmount} onChange={e => setConfigCcssFixedAmount(e.target.value)} className="w-full pl-6 pr-2 py-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input type="checkbox" checked={configCcssDivideByTwo} onChange={e => setConfigCcssDivideByTwo(e.target.checked)} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                          <span className="text-xs font-semibold text-slate-700">Dividir entre 2 para pago quincenal</span>
                        </label>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 space-y-1 text-xs">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Deducción mensual:</span>
                          <span className="font-bold text-slate-800">₡{calculatedCcssMonthly.toLocaleString('es-CR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Deducción quincenal:</span>
                          <span className="font-bold text-slate-800">₡{calculatedCcssFortnightly.toLocaleString('es-CR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex flex-col items-center">
                    <ActionButton
                      type="button"
                      label={
                        <span className="flex flex-col items-center justify-center text-center leading-tight">
                          <span>APLICAR ESTA CONFIGURACIÓN</span>
                          <span>A TODOS LOS COLABORADORES</span>
                        </span>
                      }
                      onClick={() => setShowBulkConfirmModal1(true)}
                      variant="warning"
                      className="w-full !py-2.5 !px-3 !text-[11px] !leading-tight !h-auto !min-h-0 ![&_div]:whitespace-normal ![&_div]:w-full ![&_div]:flex ![&_div]:justify-center !font-extrabold !tracking-normal shadow-xs hover:scale-[1.005] transition-transform"
                    />
                    <p className="text-[10px] text-slate-500 text-center mt-1.5 font-medium">
                      Copia la configuración actual de este colaborador a todos los demás.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-4 sm:px-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 rounded-b-2xl flex-none">
              <ActionButton label="Cancelar" onClick={() => setShowConfigModal(false)} variant="secondary" />
              <ActionButton label="Guardar" onClick={handleSaveConfig} variant="primary" />
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
          show={showSalaryConfirmModal1}
          onClose={() => {
              setShowSalaryConfirmModal1(false);
              setConfigBaseSalary((selectedEmployee?.baseSalary || 0).toString());
          }}
          onConfirm={() => {
              setShowSalaryConfirmModal1(false);
              setShowSalaryConfirmModal2(true);
          }}
          title="¿Deseas modificar el salario base de este colaborador?"
          description={`Salario actual: ₡${(selectedEmployee?.baseSalary || 0).toLocaleString('es-CR')}\nNuevo salario: ₡${parsedConfigBaseSalary.toLocaleString('es-CR')}`}
          confirmLabel="CONTINUAR"
          variant="warning"
      />
      <ConfirmModal
          show={showSalaryConfirmModal2}
          onClose={() => {
              setShowSalaryConfirmModal2(false);
              setConfigBaseSalary((selectedEmployee?.baseSalary || 0).toString());
          }}
          onConfirm={async () => {
              if (selectedEmployee && updateEmployee) {
                  try {
                      await updateEmployee({ baseSalary: parsedConfigBaseSalary }, selectedEmployee.id);
                      setShowSalaryConfirmModal2(false);
                  } catch (err) {
                      console.error("Error updating salary:", err);
                      alert("Error al actualizar el salario.");
                  }
              }
          }}
          title="CONFIRMACIÓN FINAL"
          description={`Esta modificación cambiará el salario base registrado en el módulo Colaboradores y será utilizado para futuros cálculos de nómina.\n\nAnterior: ₡${(selectedEmployee?.baseSalary || 0).toLocaleString('es-CR')}\nNuevo: ₡${parsedConfigBaseSalary.toLocaleString('es-CR')}`}
          confirmLabel="CONFIRMAR CAMBIO"
          variant="danger"
      />
      <ConfirmModal
          show={showCcssConfirmModal}
          onClose={() => {
              setShowCcssConfirmModal(false);
              setConfigReportadoCCSS((selectedEmployee?.reportadoCCSS || selectedEmployee?.baseSalary || 0).toString());
          }}
          onConfirm={async () => {
              if (selectedEmployee && updateEmployee) {
                  try {
                      await updateEmployee({ reportadoCCSS: parsedReportado, ccssDeduction: calculatedCcssMonthly, ccssDeductionQuincenal: calculatedCcssFortnightly }, selectedEmployee.id);
                      setShowCcssConfirmModal(false);
                  } catch (err) {
                      console.error("Error updating CCSS salary:", err);
                      alert("Error al actualizar el salario reportado a CCSS.");
                  }
              }
          }}
          title="Confirmar cambio de salario reportado a CCSS"
          description={`Se modificará el salario reportado a CCSS del colaborador.\n\nAnterior: ₡${(selectedEmployee?.reportadoCCSS || selectedEmployee?.baseSalary || 0).toLocaleString('es-CR')}\nNuevo: ₡${parsedReportado.toLocaleString('es-CR')}\n\n¿Deseas continuar?`}
          confirmLabel="CONFIRMAR CAMBIO"
          variant="warning"
      />
      {/* Modales de Confirmación para Valor Hora Base */}
      <ConfirmModal
          show={showValHoraBaseConfirm1}
          onClose={handleCancelValHoraBaseConfirm}
          onConfirm={handleConfirmValHoraBase1}
          title="¿MODIFICAR VALOR HORA BASE?"
          description={`Has cambiado manualmente el Valor Hora Base.\n\nAnterior: ₡${(isManualValHoraBase && manualValHoraBaseNum !== null ? manualValHoraBaseNum : autoValHoraBase).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nNuevo: ₡${(pendingValHoraBase || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nEste valor manual reemplazará el cálculo automático (Salario Base / Horas base mensuales). ¿Deseas continuar?`}
          confirmLabel="CONTINUAR"
          variant="warning"
      />
      <ConfirmModal
          show={showValHoraBaseConfirm2}
          onClose={handleCancelValHoraBaseConfirm}
          onConfirm={handleConfirmValHoraBase2}
          title="CONFIRMACIÓN FINAL - VALOR HORA BASE"
          description={`Esta es la confirmación definitiva para establecer manualmente el Valor Hora Base en ₡${(pendingValHoraBase || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\n\n¿Confirmas que deseas aplicar este cambio personalizado?`}
          confirmLabel="CONFIRMAR Y APLICAR"
          variant="danger"
      />

      {/* Modales de Confirmación para Valor Hora Ordinaria */}
      <ConfirmModal
          show={showValHoraOrgConfirm1}
          onClose={handleCancelValHoraOrgConfirm}
          onConfirm={handleConfirmValHoraOrg1}
          title="¿MODIFICAR VALOR HORA ORDINARIA?"
          description={`Has cambiado manualmente el Valor Hora Ordinaria.\n\nAnterior: ₡${(isManualValHoraOrg && manualValHoraOrgNum !== null ? manualValHoraOrgNum : autoValHoraOrg).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nNuevo: ₡${(pendingValHoraOrg || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nEste valor manual reemplazará el cálculo automático (Valor Hora Base × Multiplicador). ¿Deseas continuar?`}
          confirmLabel="CONTINUAR"
          variant="warning"
      />
      <ConfirmModal
          show={showValHoraOrgConfirm2}
          onClose={handleCancelValHoraOrgConfirm}
          onConfirm={handleConfirmValHoraOrg2}
          title="CONFIRMACIÓN FINAL - VALOR HORA ORDINARIA"
          description={`Esta es la confirmación definitiva para establecer manualmente el Valor Hora Ordinaria en ₡${(pendingValHoraOrg || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\n\n¿Confirmas que deseas aplicar este cambio personalizado?`}
          confirmLabel="CONFIRMAR Y APLICAR"
          variant="danger"
      />

      {/* Modales de Confirmación para Valor Hora para Recargos */}
      <ConfirmModal
          show={showValHoraRecargosConfirm1}
          onClose={handleCancelValHoraRecargosConfirm}
          onConfirm={handleConfirmValHoraRecargos1}
          title="¿MODIFICAR VALOR HORA PARA RECARGOS?"
          description={`Has cambiado manualmente el Valor Hora para Recargos.\n\nAnterior: ₡${(isManualValHoraRecargos && manualValHoraRecargosNum !== null ? manualValHoraRecargosNum : autoValHoraRecargos).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nNuevo: ₡${(pendingValHoraRecargos || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nEste valor manual reemplazará el cálculo automático (Valor Hora Base) para recargos. ¿Deseas continuar?`}
          confirmLabel="CONTINUAR"
          variant="warning"
      />
      <ConfirmModal
          show={showValHoraRecargosConfirm2}
          onClose={handleCancelValHoraRecargosConfirm}
          onConfirm={handleConfirmValHoraRecargos2}
          title="CONFIRMACIÓN FINAL - VALOR HORA PARA RECARGOS"
          description={`Esta es la confirmación definitiva para establecer manualmente el Valor Hora para Recargos en ₡${(pendingValHoraRecargos || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\n\n¿Confirmas que deseas aplicar este cambio personalizado?`}
          confirmLabel="CONFIRMAR Y APLICAR"
          variant="danger"
      />

      <ConfirmModal
          show={showBulkConfirmModal1}
          onClose={() => setShowBulkConfirmModal1(false)}
          onConfirm={() => {
              setShowBulkConfirmModal1(false);
              setShowBulkConfirmModal2(true);
          }}
          title="¿APLICAR CONFIGURACIÓN A TODOS?"
          description={
            <div className="space-y-3 text-left">
              <p className="text-xs font-medium text-slate-600">
                La configuración actual de este colaborador será utilizada como configuración de cálculo para todos los colaboradores.
              </p>
              <p className="text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                ✔️ Los salarios base e individuales de cada colaborador permanecerán intactos. Solo se copiarán los parámetros de configuración de cálculo y se recalcularán sus deducciones de CCSS de forma individual.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2 uppercase tracking-wide text-[10px]">Parámetros que serán copiados:</div>
                <div className="flex justify-between"><span className="text-slate-500">Horas base mensuales:</span> <span className="font-semibold text-slate-800">{configSalaryDivisor}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Multiplicador ordinario:</span> <span className="font-semibold text-slate-800">{configOrdinaryMultiplier}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Valor hora base:</span> <span className="font-bold text-slate-800">₡{configValHoraBase.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Valor hora ordinaria:</span> <span className="font-bold text-blue-700">₡{configValHoraOrg.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Multiplicador hora extra:</span> <span className="font-semibold text-slate-800">{configExtraMultiplier}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Valor hora extra:</span> <span className="font-bold text-amber-700">₡{configValHoraExt.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Multiplicador hora feriado:</span> <span className="font-semibold text-slate-800">{configHolidayMultiplier}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Valor hora feriado:</span> <span className="font-bold text-emerald-700">₡{configValHoraFeriado.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1"><span className="text-slate-500">Tipo deducción CCSS:</span> <span className="font-semibold text-slate-800">{configCcssType === 'percentage' ? 'Porcentaje' : 'Monto fijo'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Porcentaje / Monto CCSS:</span> <span className="font-semibold text-slate-800">{configCcssType === 'percentage' ? `${parsedPercentage}%` : `₡${parsedFixed.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">División quincenal CCSS:</span> <span className="font-semibold text-slate-800">{configCcssDivideByTwo ? 'Sí' : 'No'}</span></div>
              </div>
            </div>
          }
          confirmLabel="CONTINUAR"
          variant="warning"
      />
      <ConfirmModal
          show={showBulkConfirmModal2}
          onClose={() => setShowBulkConfirmModal2(false)}
          onConfirm={executeBulkApplyConfig}
          title="CONFIRMACIÓN FINAL"
          description={
            <div className="space-y-3 text-center">
              <p className="text-xs font-semibold text-slate-600">
                Esta acción modificará la configuración de cálculo de <strong>TODOS los colaboradores</strong>.
              </p>
              <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-left">
                ✔️ Los salarios base e individuales de cada colaborador NO serán alterados. Solo se actualizarán sus configuraciones generales de cálculo de horas y porcentajes de deducción de CCSS de forma individual.
              </p>
            </div>
          }
          confirmLabel="CONFIRMAR Y APLICAR A TODOS"
          variant="danger"
          isLoading={isBulkSubmitting}
      />
    </>,
    document.body
  );
};
