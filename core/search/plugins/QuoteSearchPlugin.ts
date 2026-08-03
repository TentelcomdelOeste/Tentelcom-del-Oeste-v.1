import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User, Quote } from '../../../utils/types';

export class QuoteSearchPlugin implements ISearchPlugin {
  moduleId = 'cotizaciones';
  name = 'Cotizaciones';
  version = '1.0.0';

  canAccess(user: User | null): boolean {
    if (!user) return false;
    return user.role === 'admin' || this.checkPermission(user, 'cotizaciones');
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
      module: 'cotizaciones',
      selectedId: item.id.replace('quote_', ''),
      selectedKey: 'docId'
    };
  }

  mapToSearchableItem(quote: Quote): SearchableItem {
    const contentParts = [
      quote.id?.toString(),
      quote.empresa,
      quote.contacto,
      quote.observaciones,
      quote.codigoCliente,
      quote.correo
    ].filter(Boolean).join(' ');

    return {
      id: `quote_${quote.docId || quote.id}`,
      moduleId: this.moduleId,
      title: `Cotización ${quote.id}`,
      subtitle: `Cliente: ${quote.empresa}`,
      content: contentParts,
      affinityTags: ['quotes', String(quote.docId || quote.id)],
      metadata: {
        monto: quote.monto,
        moneda: quote.moneda
      },
      updatedAt: Date.now()
    };
  }
}
