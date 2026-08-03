import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User } from '../../../utils/types';

export class DispatchSearchPlugin implements ISearchPlugin {
  moduleId = 'dispatch';
  name = 'Despacho de Materiales';
  version = '1.0.0';

  canAccess(user: User | null): boolean {
    if (!user) return false;
    return user.role === 'admin' || this.checkPermission(user, 'dispatch') || this.checkPermission(user, 'material_reports');
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
      module: 'dispatch',
      selectedId: item.id.replace('dispatch_', ''),
      selectedKey: 'id'
    };
  }

  mapToSearchableItem(req: any): SearchableItem {
    const itemsSummary = Array.isArray(req.items) 
      ? req.items.map((i: any) => `${i.code || ''} ${i.description || ''}`).join(' ')
      : '';

    const contentParts = [
      req.requestNumber,
      req.projectName,
      req.projectCode,
      req.requestedBy,
      req.status,
      itemsSummary,
      req.id
    ].filter(Boolean).join(' ');

    return {
      id: `dispatch_${req.id}`,
      moduleId: this.moduleId,
      title: `Despacho #${req.requestNumber || req.id}`,
      subtitle: `Proyecto: ${req.projectName || req.projectCode || 'N/A'} - Solicitado por: ${req.requestedBy || 'N/A'}`,
      content: contentParts,
      affinityTags: ['despacho', 'materiales', req.id],
      metadata: {
        requestNumber: req.requestNumber,
        status: req.status,
        projectName: req.projectName
      },
      updatedAt: Date.now()
    };
  }
}
