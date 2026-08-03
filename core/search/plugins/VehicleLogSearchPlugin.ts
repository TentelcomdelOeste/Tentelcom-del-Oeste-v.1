import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User } from '../../../utils/types';
import { VehicleLog } from '../../../types/vehicle.types';

export class VehicleLogSearchPlugin implements ISearchPlugin {
  moduleId = 'vehicles_logs';
  name = 'Bitácoras Operativas';
  version = '1.0.0';

  canAccess(user: User | null): boolean {
    if (!user) return false;
    return user.role === 'admin' || this.checkPermission(user, 'vehicles_logs');
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
      module: 'vehicles_logs',
      selectedId: item.id.replace('vehicleLog_', ''),
      selectedKey: 'id'
    };
  }

  mapToSearchableItem(log: VehicleLog): SearchableItem {
    const contentParts = [
      log.unidadParam,
      log.conductorParam,
      log.motivo,
      log.lugar,
      log.comentarios,
      log.status
    ].filter(Boolean).join(' ');

    return {
      id: `vehicleLog_${log.id}`,
      moduleId: this.moduleId,
      title: `Bitácora: ${log.unidadParam || 'Sin Unidad'}`,
      subtitle: `Conductor: ${log.conductorParam || 'N/A'} - Motivo: ${log.motivo || 'N/A'}`,
      content: contentParts,
      affinityTags: ['vehiculos', log.id, log.unidadParam || ''],
      metadata: {
        unidadParam: log.unidadParam,
        conductorParam: log.conductorParam,
        status: log.status
      },
      updatedAt: Date.now()
    };
  }
}
