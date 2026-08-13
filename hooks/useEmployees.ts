import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';

// Global cache to prevent redundant queries
let cachedEmployees: { id: string, name: string, status?: string, isArchived?: boolean }[] | null = null;
let employeesPromise: Promise<{ id: string, name: string, status?: string, isArchived?: boolean }[]> | null = null;

export const clearEmployeesCache = () => {
  cachedEmployees = null;
  employeesPromise = null;
};

export const useEmployees = () => {
  const [employees, setEmployees] = useState<{ id: string, name: string, status?: string, isArchived?: boolean }[]>(cachedEmployees || []);
  const [loading, setLoading] = useState(!cachedEmployees);

  useEffect(() => {
    if (cachedEmployees) {
      setEmployees(cachedEmployees);
      setLoading(false);
      return;
    }

    if (!employeesPromise) {
      employeesPromise = getDocs(collection(db, "employees")).then(querySnapshot => {
        const empList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().displayName || doc.data().name || doc.id,
          status: doc.data().status,
          isArchived: doc.data().isArchived
        }));
        cachedEmployees = empList;
        return empList;
      }).catch(error => {
        console.error("Error fetching employees:", error);
        return [];
      });
    }

    employeesPromise.then(empList => {
      setEmployees(empList);
      setLoading(false);
    });

  }, []);

  const activeEmployees = employees.filter(emp => emp.status !== 'archivado' && !emp.isArchived);

  return { employees, activeEmployees, loading };
};
