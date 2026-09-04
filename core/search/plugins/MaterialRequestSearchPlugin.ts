import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User } from '../../../utils/types';
import { can, isAdmin } from '../../../utils/permissions';

export class MaterialRequestSearchPlugin implements ISearchPlugin {
  moduleId = 'material_reports';
  name = 'Solicitudes de Material';
  version = '1.0.0';

  canAccess(user: User | null): boolean {
    if (!user) return false;
    return isAdmin(user.role) || can(user, 'inventario.solicitudes');
  }

  getNavigationContext(item: SearchableItem): SmartNavigationContext {
    return {
      module: 'material_reports',
      selectedId: item.id.replace('mat_request_', ''),
      selectedKey: 'id'
    };
  }

  mapToSearchableItem(request: any): SearchableItem {
    const contentParts = [
      request.id,
      request.proyecto,
      request.solicitante,
      request.estado,
      request.notas
    ].filter(Boolean).join(' ');

    return {
      id: `mat_request_${request.id}`,
      moduleId: this.moduleId,
      title: `Solicitud de Material ${request.id}`,
      subtitle: `Proyecto: ${request.proyecto || 'N/A'}`,
      content: contentParts,
      affinityTags: ['solicitudes_material', request.id],
      metadata: {
        estado: request.estado
      },
      updatedAt: Date.now()
    };
  }
}
