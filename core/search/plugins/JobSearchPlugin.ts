import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User } from '../../../utils/types';
import { Trabajo } from '../../../modules/job_scheduling/types';

export class JobSearchPlugin implements ISearchPlugin {
  moduleId = 'job_scheduling';
  name = 'Programación de Trabajos';
  version = '1.0.0';

  canAccess(user: User | null): boolean {
    if (!user) return false;
    return user.role === 'admin' || this.checkPermission(user, 'job_scheduling');
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
      module: 'job_scheduling',
      selectedId: item.id.replace('job_', ''),
      selectedKey: 'id'
    };
  }

  mapToSearchableItem(job: Trabajo): SearchableItem {
    const contentParts = [
      job.ot_code,
      job.cliente,
      job.lugar,
      job.tipo_trabajo,
      job.titulo,
      job.descripcion,
      job.estado
    ].filter(Boolean).join(' ');

    return {
      id: `job_${job.id}`,
      moduleId: this.moduleId,
      title: `${job.ot_code ? `[${job.ot_code}] ` : ''}${job.titulo || job.tipo_trabajo || 'Sin Título'}`,
      subtitle: `Trabajo - Cliente: ${job.cliente || 'N/A'} - Estado: ${job.estado}`,
      content: contentParts,
      affinityTags: ['programacion_trabajos', job.id],
      metadata: {
        ot_code: job.ot_code,
        estado: job.estado,
        cliente: job.cliente
      },
      updatedAt: Date.now()
    };
  }
}
