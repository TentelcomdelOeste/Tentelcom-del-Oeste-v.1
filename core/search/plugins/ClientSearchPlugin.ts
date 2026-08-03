import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User, Client } from '../../../utils/types';

export class ClientSearchPlugin implements ISearchPlugin {
  moduleId = 'cotizaciones';
  name = 'Clientes';
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
      selectedId: item.id.replace('client_', ''),
      selectedKey: 'clienteId'
    };
  }

  // Helper to map a raw Client to a SearchableItem
  mapToSearchableItem(client: Client): SearchableItem {
    const contentParts = [
      client.empresa,
      client.contacto,
      client.codigoCliente || '',
      client.telefono,
      client.correo
    ].filter(Boolean).join(' ');

    return {
      id: `client_${client.id}`,
      moduleId: this.moduleId,
      title: client.empresa || 'Sin Empresa',
      subtitle: `Cliente: ${client.contacto || 'Sin Contacto'}${client.codigoCliente ? ` - ${client.codigoCliente}` : ''}`,
      content: contentParts,
      affinityTags: ['clientes', client.id],
      metadata: {
        codigoCliente: client.codigoCliente,
        telefono: client.telefono,
        correo: client.correo
      },
      updatedAt: Date.now()
    };
  }
}
