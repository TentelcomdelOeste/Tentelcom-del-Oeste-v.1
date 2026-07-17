// services/conflictResolutionPolicy.ts

export const resolveConflict = (localData: any, remoteData: any): any => {
  // Simple timestamp-based resolution (Remote-wins if remote is newer)
  const localTime = new Date(localData.metadata?.updatedAt || 0).getTime();
  const remoteTime = new Date(remoteData.metadata?.updatedAt || 0).getTime();
  
  return remoteTime > localTime ? remoteData : localData;
};
