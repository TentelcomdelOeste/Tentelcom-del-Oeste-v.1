import { globalSearchEngine } from '../GlobalSearchEngine';
import { SearchableItem, ISearchPlugin } from '../types';

// Dummy plugin for testing
class TestPlugin implements ISearchPlugin {
  moduleId = 'test_module';
  name = 'Test Module';
  version = '1.0.0';
  
  canAccess(user: any): boolean {
    return user?.role === 'admin' || user?.permissions?.includes('test');
  }
  
  getNavigationContext(item: SearchableItem) {
    return {
      module: 'test_module',
      selectedId: item.id.replace('test_', ''),
      selectedKey: 'id'
    };
  }
}

export const runSearchTestSuite = async () => {
  console.log('--- STARTING GLOBAL SEARCH ENGINE TEST SUITE ---');
  let passed = 0;
  let failed = 0;
  
  const assert = (condition: boolean, name: string) => {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  };

  const adminUser = { role: 'admin' };
  const normalUser = { role: 'user', permissions: [] };
  
  // 1. Register test plugin
  const testPlugin = new TestPlugin();
  globalSearchEngine.registerPlugin(testPlugin);
  
  // 2. Incremental Indexing
  const t1 = performance.now();
  await globalSearchEngine.upsertDocument({
    id: 'test_1',
    moduleId: 'test_module',
    title: 'Cotización Especial Anual',
    subtitle: 'Cliente A',
    content: 'Servicio de mantenimiento anual preventivo',
    affinityTags: ['mantenimiento', 'anual'],
    metadata: { val: 1 },
    updatedAt: Date.now()
  });
  
  await globalSearchEngine.upsertDocument({
    id: 'test_2',
    moduleId: 'test_module',
    title: 'Reparación de Motor',
    subtitle: 'Cliente B',
    content: 'Servicio de mantenimiento correctivo de motor',
    affinityTags: ['motor', 'correctivo'],
    metadata: { val: 2 },
    updatedAt: Date.now()
  });
  const t2 = performance.now();
  console.log(`[INFO] Indexed 2 documents in ${(t2 - t1).toFixed(2)}ms`);

  // 3. Exact search
  const res1 = await globalSearchEngine.search('Reparación', adminUser);
  assert(res1.length === 1 && res1[0].id === 'test_2', 'Exact Search');

  // 4. Partial search
  const res2 = await globalSearchEngine.search('mante', adminUser);
  assert(res2.length === 2, 'Partial Search');

  // 5. Multiple words
  const res3 = await globalSearchEngine.search('mantenimiento correctivo', adminUser);
  assert(res3.length === 1 && res3[0].id === 'test_2', 'Multiple words search (ordering)');

  // 6. Relevance (score ordering)
  const res4 = await globalSearchEngine.search('anual', adminUser);
  assert(res4.length === 1 && res4[0].id === 'test_1', 'Relevance Search');

  // 7. STAF Permissions
  const res5 = await globalSearchEngine.search('mantenimiento', normalUser);
  assert(res5.length === 0, 'Permissions (STAF) enforcement');

  // 8. Incremental update
  await globalSearchEngine.upsertDocument({
    id: 'test_1',
    moduleId: 'test_module',
    title: 'Cotización Especial Anual (Actualizada)',
    subtitle: 'Cliente A',
    content: 'Servicio de mantenimiento anual preventivo',
    affinityTags: ['mantenimiento', 'anual'],
    metadata: { val: 1 },
    updatedAt: Date.now()
  });
  const res6 = await globalSearchEngine.search('Actualizada', adminUser);
  assert(res6.length === 1 && res6[0].id === 'test_1', 'Incremental Update');

  // 9. Deletion
  await globalSearchEngine.removeDocument('test_2');
  const res7 = await globalSearchEngine.search('Motor', adminUser);
  assert(res7.length === 0, 'Item Deletion');

  // 10. Navigation generated
  const nav = testPlugin.getNavigationContext(res6[0]);
  assert(nav.module === 'test_module' && nav.selectedId === '1', 'Navigation Generation');

  // 11. Empty modules handling
  const res8 = await globalSearchEngine.search('palabra_inexistente_123', adminUser);
  assert(res8.length === 0, 'Handling modules without results');

  console.log(`--- TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ---`);
  return { passed, failed };
};
