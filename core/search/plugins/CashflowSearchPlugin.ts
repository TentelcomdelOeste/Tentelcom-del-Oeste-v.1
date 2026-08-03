import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User } from '../../../utils/types';
import { CashflowEntry } from '../../../cashflowTypes';

export class CashflowSearchPlugin implements ISearchPlugin {
  moduleId = 'cashflow';
  name = 'Flujo de Caja';
  version = '1.0.0';

  canAccess(user: User | null): boolean {
    if (!user) return false;
    return user.role === 'admin' || this.checkPermission(user, 'cashflow');
  }

  private checkPermission(user: User, permission: string): boolean {
    if (user.role === 'admin') return true;
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions.includes(permission);
    }
    return false;
  }

  getNavigationContext(item: SearchableItem): SmartNavigationContext {
    return {
      module: 'cashflow',
      selectedId: item.id.replace('cashflow_', ''),
      selectedKey: 'id'
    };
  }

  mapToSearchableItem(entry: CashflowEntry): SearchableItem {
    const contentParts = [
      entry.concepto,
      entry.categoria,
      entry.referencia,
      entry.entidad
    ].filter(Boolean).join(' ');

    return {
      id: `cashflow_${entry.id}`,
      moduleId: this.moduleId,
      title: entry.concepto || 'Sin Concepto',
      subtitle: `Flujo de Caja - Categoria: ${entry.categoria || 'N/A'}`,
      content: contentParts,
      affinityTags: ['flujo_caja', entry.id],
      metadata: {
        tipo: entry.tipo,
        monto: entry.monto
      },
      updatedAt: Date.now()
    };
  }
}
