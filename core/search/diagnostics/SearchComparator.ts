import { globalSearchEngine } from '../GlobalSearchEngine';
import { localDocStore } from '../../offline/localDocStore';

export const runSearchComparator = async (term: string, user: any) => {
  if (term.length < 2) {
    console.warn("Term too short");
    return;
  }
  
  console.log(`--- STARTING COMPARATOR FOR TERM: "${term}" ---`);
  const t1 = performance.now();
  
  // 1. New Engine
  const newResults = await globalSearchEngine.search(term, user);
  const t2 = performance.now();
  const timeNew = t2 - t1;
  
  // 2. Old Search Simulation (using local store)
  const t3 = performance.now();
  const oldResults: any[] = [];
  const termLower = term.toLowerCase();
  
  const safeLower = (val: any) => (val || "").toString().toLowerCase();
  
  try {
    const quotes = await localDocStore.getLocalCollection("quotes");
    quotes.forEach(q => {
      const data = q.data;
      if (safeLower(data.empresa).includes(termLower) || safeLower(q.docId).includes(termLower) || safeLower(data.contacto).includes(termLower)) {
        oldResults.push({ id: q.docId, type: 'quote', title: `Cotización #${data.id}` });
      }
    });
    
    const clients = await localDocStore.getLocalCollection("clients");
    clients.forEach(c => {
      const data = c.data;
      if (safeLower(data.empresa).includes(termLower) || safeLower(data.codigoCliente).includes(termLower) || safeLower(data.contacto).includes(termLower)) {
        oldResults.push({ id: c.docId, type: 'client', title: data.empresa });
      }
    });
    
    const inventory = await localDocStore.getLocalCollection("inventory_items");
    inventory.forEach(i => {
      const data = i.data;
      if (safeLower(data.description).includes(termLower) || safeLower(data.code).includes(termLower) || safeLower(data.family).includes(termLower)) {
        oldResults.push({ id: i.docId, type: 'inventory', title: data.description });
      }
    });
    
  } catch(e) {
    console.error("Error reading local docs for old search comparison", e);
  }
  
  const t4 = performance.now();
  const timeOld = t4 - t3;
  
  console.log(`[NEW ENGINE] Results: ${newResults.length} in ${timeNew.toFixed(2)}ms`);
  console.log(`[OLD ENGINE] Results: ${oldResults.length} in ${timeOld.toFixed(2)}ms`);
  
  const newIds = new Set(newResults.map(r => r.id));
  
  // We cannot perfectly match the exact IDs for old search because we added prefix (e.g. quote_XXX)
  // Let's strip prefix for comparison
  const strippedNewIds = new Set(newResults.map(r => {
    return r.id.replace('quote_', '').replace('client_', '').replace('inventory_', '').replace('job_', '').replace('vehicleLog_', '');
  }));
  
  const missingInNew = oldResults.filter(r => !strippedNewIds.has(r.id));
  
  // We can't easily find "missing in old" because new engine searches more fields and modules (jobs, vehicle logs)
  
  console.log(`[DIFFERENCES] Missing in New Engine: ${missingInNew.length}`, missingInNew);
  console.log(`[DIFFERENCES] Additional in New Engine: ${newResults.length - oldResults.length + missingInNew.length}`);
  
  console.log('--- COMPARISON COMPLETE ---');
};
