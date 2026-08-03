import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User } from '../../../utils/types';
import { Product } from '../../../types';

export class CatalogSearchPlugin implements ISearchPlugin {
  moduleId = 'external_products';
  name = 'Catálogo de Productos';
  version = '1.0.0';

  canAccess(user: User | null): boolean {
    if (!user) return false;
    return user.role === 'admin' || this.checkPermission(user, 'external_products') || this.checkPermission(user, 'inventory_general');
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
      module: 'external_products',
      selectedId: item.id.replace('prod_', ''),
      selectedKey: 'id'
    };
  }

  mapToSearchableItem(prod: Product): SearchableItem {
    const contentParts = [
      prod.codigo,
      prod.nombre,
      prod.categoria,
      prod.marca,
      prod.descripcion,
      prod.id
    ].filter(Boolean).join(' ');

    return {
      id: `prod_${prod.id}`,
      moduleId: this.moduleId,
      title: prod.nombre || 'Producto Catálogo',
      subtitle: `Catálogo - Código: ${prod.codigo || 'N/A'}${prod.categoria ? ` - ${prod.categoria}` : ''}`,
      content: contentParts,
      affinityTags: ['catalogo', 'productos', prod.id],
      metadata: {
        codigo: prod.codigo,
        precio: prod.precioBaseUSD,
        categoria: prod.categoria
      },
      updatedAt: Date.now()
    };
  }
}
