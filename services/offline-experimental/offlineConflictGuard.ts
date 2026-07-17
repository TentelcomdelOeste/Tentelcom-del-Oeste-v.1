// services/offline-experimental/offlineConflictGuard.ts

// Simple conflict guard for basic validation
export const isConflict = (localMutation: any, remoteDoc: any): boolean => {
  // If remote document has been modified after local mutation creation, 
  // it might be a conflict. Simple timestamp check.
  if (localMutation.createdAt < (remoteDoc.updatedAt || 0)) {
    return true;
  }
  return false;
};
