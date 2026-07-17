// services/offlineMutationJournal.ts

import { saveEntity } from './localRepositories';
import { STORES } from './localDb';
import { Mutation } from './offlineMutationQueue';

export const logMutation = async (mutation: Mutation, status: Mutation['syncStatus']): Promise<void> => {
  const journalEntry = {
    ...mutation,
    syncStatus: status,
    updatedAt: Date.now()
  };
  await saveEntity(STORES.mutation_journal, journalEntry);
};
