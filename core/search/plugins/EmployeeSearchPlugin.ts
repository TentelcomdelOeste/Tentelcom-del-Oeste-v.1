import { ISearchPlugin, SearchableItem, SmartNavigationContext } from '../types';
import { User } from '../../../utils/types';

export class EmployeeSearchPlugin implements ISearchPlugin {
  moduleId = 'admin';
  name = 'Personal / Empleados';
  version = '1.0.0';

  canAccess(user: User | null): boolean {
    if (!user) return false;
    return user.role === 'admin' || this.checkPermission(user, 'admin');
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
      module: 'admin',
      selectedId: item.id.replace('emp_', ''),
      selectedKey: 'id'
    };
  }

  mapToSearchableItem(emp: any): SearchableItem {
    const empName = emp.name || emp.displayName || 'Sin Nombre';
    const contentParts = [
      empName,
      emp.email || '',
      emp.role || '',
      emp.status || '',
      emp.id || ''
    ].filter(Boolean).join(' ');

    return {
      id: `emp_${emp.id}`,
      moduleId: this.moduleId,
      title: empName,
      subtitle: `Personal - Estado: ${emp.status || 'Activo'}${emp.role ? ` - Rol: ${emp.role}` : ''}`,
      content: contentParts,
      affinityTags: ['empleados', 'admin', emp.id],
      metadata: {
        email: emp.email,
        role: emp.role,
        status: emp.status
      },
      updatedAt: Date.now()
    };
  }
}
