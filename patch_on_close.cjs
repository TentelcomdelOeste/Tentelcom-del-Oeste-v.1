const fs = require('fs');
let code = fs.readFileSync('modules/finance/cashflow/import/CashflowImportWizard.tsx', 'utf8');

const target = `            {state.step === ImportStep.RESULT && (
              <ActionButton
                label="Finalizar"
                variant="primary"
                onClick={onClose}
                icon={<FiCheckCircle />}
              />
            )}`;

const replacement = `            {state.step === ImportStep.RESULT && (
              <ActionButton
                label="Finalizar"
                variant="primary"
                onClick={() => {
                  if (state.result?.success && onSuccess) {
                     onSuccess();
                  }
                  onClose();
                }}
                icon={<FiCheckCircle />}
              />
            )}`;

if(code.includes(target)) {
  fs.writeFileSync('modules/finance/cashflow/import/CashflowImportWizard.tsx', code.replace(target, replacement));
  console.log('Patched onClose in RESULT');
} else {
  console.log('Target not found');
}
