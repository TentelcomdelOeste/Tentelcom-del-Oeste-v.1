sed -i '58a \
export const getApprovedQuotes = async (): Promise<Quote[]> => {\
  try {\
    const q = query(collection(db, "quotes"), where("estado", "==", "Aprobada"), orderBy("id", "desc"));\
    const snapshot = await getDocs(q);\
    return snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id } as Quote));\
  } catch (error) {\
    console.error("Error fetching approved quotes:", error);\
    return [];\
  }\
};\
' modules/project_management/services/projectService.ts
