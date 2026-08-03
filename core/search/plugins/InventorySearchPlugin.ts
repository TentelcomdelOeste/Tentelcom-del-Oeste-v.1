import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User } from '../../../utils/types';
import { InventoryItem } from '../../../inventoryTypes';

export class InventorySearchPlugin implements ISearchPlugin {
  moduleId = 'inventory_general';
  name = 'Inventario';
  version = '1.0.0';

  canAccess(user: User | null): boolean {
    if (!user) return false;
    return user.role === 'admin' || this.checkPermission(user, 'inventory_general');
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
      module: 'inventory_general',
      selectedId: item.id.replace('inventory_', ''),
      selectedKey: 'id'
    };
  }

  mapToSearchableItem(item: InventoryItem): SearchableItem {
    const contentParts = [
      item.code,
      item.description,
      item.family,
      item.unit
    ].filter(Boolean).join(' ');

    return {
      id: `inventory_${item.id}`,
      moduleId: this.moduleId,
      title: item.description || 'Sin Descripción',
      subtitle: `Inventario: ${item.code || ''}`,
      content: contentParts,
      affinityTags: ['inventario', item.id],
      metadata: {
        code: item.code,
        price: item.price,
        stock: item.stock
      },
      updatedAt: Date.now()
    };
  }
}
