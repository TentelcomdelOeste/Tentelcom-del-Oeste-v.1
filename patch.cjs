const fs = require('fs');
let code = fs.readFileSync('modules/finance/cashflow/import/CashflowImportWizard.tsx', 'utf8');

const target = `    if (state.step === ImportStep.PREVIEW) {
      // Import is not implemented yet
      alert('La importación masiva de datos se habilitará en la Fase 5.');
      return;
    }
    setState(prev => ({
      ...prev,
      step: prev.step + 1
    }));
  };`;

const replacement = `    if (state.step === ImportStep.PREVIEW) {
      setState(prev => ({ ...prev, step: ImportStep.IMPORTING, progress: null }));
      
      const doImport = async () => {
        try {
           const result = await cashflowImportService.importData(
              state.validatedEntries,
              currentUser,
              (progress) => {
                 setState(prev => ({ ...prev, progress }));
              }
           );
           
           setState(prev => ({
              ...prev,
              step: ImportStep.RESULT,
              result
           }));
           
           if (result.success && onSuccess) {
              // We don't automatically close so the user can see the result, 
              // but we can call onSuccess to refresh lists in the background
              onSuccess();
           }
        } catch (err: any) {
           alert('Error grave durante la importación: ' + err.message);
           setState(prev => ({ ...prev, step: ImportStep.PREVIEW }));
        }
      };
      
      doImport();
      return;
    }

    setState(prev => ({
      ...prev,
      step: prev.step + 1
    }));
  };`;

if(code.includes(target)) {
  fs.writeFileSync('modules/finance/cashflow/import/CashflowImportWizard.tsx', code.replace(target, replacement));
  console.log('Patched');
} else {
  console.log('Target not found');
}
