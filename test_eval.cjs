require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-typescript', '@babel/preset-react'],
  extensions: ['.js', '.jsx', '.ts', '.tsx']
});
try {
  require('./modules/FinanceModule.tsx');
  console.log('FinanceModule loaded successfully');
} catch (err) {
  console.error('Error loading FinanceModule:', err);
}
