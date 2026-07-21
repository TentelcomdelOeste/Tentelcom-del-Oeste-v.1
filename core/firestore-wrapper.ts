import * as original from "../node_modules/firebase/firestore/dist/index.mjs";

// Re-export all original Firestore exports (types, classes, queries, etc.)
export * from "../node_modules/firebase/firestore/dist/index.mjs";

/**
 * Global, recursive data sanitizer for Firestore.
 * Removes properties with 'undefined' values recursively, while preserving null, false, 0,
 * empty strings, arrays, Dates, and any Firestore special types (References, Timestamps, GeoPoints).
 */
export function sanitizeDataForFirestore<T>(val: T): T {
  // 1. Handle primitives, null, and non-objects
  if (val === null || typeof val !== "object") {
    return val;
  }

  // 2. Handle Date objects
  if (val instanceof Date) {
    return val;
  }

  // 3. Handle Arrays
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined) // Strip undefined elements from arrays
      .map((item) => sanitizeDataForFirestore(item)) as any;
  }

  // 4. Handle Special Firestore Objects (References, Timestamps, FieldValues, GeoPoints)
  // We identify plain JS objects (created via {} or new Object()) to recurse into them.
  // Other custom class instances (e.g. DocumentReference, Timestamp, etc.) are returned as-is.
  const proto = Object.getPrototypeOf(val);
  const isPlainObject = proto === null || proto === Object.prototype;

  if (!isPlainObject) {
    return val;
  }

  // 5. Handle Plain Objects: recurse and strip undefined
  const sanitized: any = {};
  for (const key of Object.keys(val)) {
    const value = (val as any)[key];
    if (value !== undefined) {
      sanitized[key] = sanitizeDataForFirestore(value);
    }
  }

  return sanitized;
}

// Intercept setDoc to sanitize input data
export const setDoc = (docRef: any, data: any, options?: any) => {
  const sanitizedData = sanitizeDataForFirestore(data);
  return original.setDoc(docRef, sanitizedData, options);
};

// Intercept updateDoc to sanitize input data (handles both objects and field-value pairs)
export const updateDoc = (docRef: any, dataOrField: any, ...moreFieldsAndValues: any[]) => {
  if (typeof dataOrField === "object" && dataOrField !== null) {
    const sanitizedData = sanitizeDataForFirestore(dataOrField);
    return original.updateDoc(docRef, sanitizedData);
  }

  const sanitizedArgs = [dataOrField];
  for (let i = 0; i < moreFieldsAndValues.length; i++) {
    if (i % 2 === 0) {
      sanitizedArgs.push(sanitizeDataForFirestore(moreFieldsAndValues[i]));
    } else {
      sanitizedArgs.push(moreFieldsAndValues[i]);
    }
  }
  return (original.updateDoc as any)(docRef, ...sanitizedArgs);
};

// Intercept addDoc to sanitize input data
export const addDoc = (collectionRef: any, data: any) => {
  const sanitizedData = sanitizeDataForFirestore(data);
  return original.addDoc(collectionRef, sanitizedData);
};

// Sanitized wrapper class for WriteBatch
export class SanitizedWriteBatch {
  private batch: any;
  constructor(batch: any) {
    this.batch = batch;
  }
  set(docRef: any, data: any, options?: any) {
    this.batch.set(docRef, sanitizeDataForFirestore(data), options);
    return this;
  }
  update(docRef: any, dataOrField: any, ...moreFieldsAndValues: any[]) {
    if (typeof dataOrField === "object" && dataOrField !== null) {
      this.batch.update(docRef, sanitizeDataForFirestore(dataOrField));
    } else {
      const sanitizedArgs = [dataOrField];
      for (let i = 0; i < moreFieldsAndValues.length; i++) {
        if (i % 2 === 0) {
          sanitizedArgs.push(sanitizeDataForFirestore(moreFieldsAndValues[i]));
        } else {
          sanitizedArgs.push(moreFieldsAndValues[i]);
        }
      }
      this.batch.update(docRef, ...sanitizedArgs);
    }
    return this;
  }
  delete(docRef: any) {
    this.batch.delete(docRef);
    return this;
  }
  commit() {
    return this.batch.commit();
  }
}

// Intercept writeBatch to return a SanitizedWriteBatch
export const writeBatch = (firestoreInstance?: any) => {
  const originalBatch = original.writeBatch(firestoreInstance || original.getFirestore());
  return new SanitizedWriteBatch(originalBatch);
};

// Sanitized wrapper class for Transaction
export class SanitizedTransaction {
  private tx: any;
  constructor(tx: any) {
    this.tx = tx;
  }
  get(docRef: any) {
    return this.tx.get(docRef);
  }
  set(docRef: any, data: any, options?: any) {
    this.tx.set(docRef, sanitizeDataForFirestore(data), options);
    return this;
  }
  update(docRef: any, dataOrField: any, ...moreFieldsAndValues: any[]) {
    if (typeof dataOrField === "object" && dataOrField !== null) {
      this.tx.update(docRef, sanitizeDataForFirestore(dataOrField));
    } else {
      const sanitizedArgs = [dataOrField];
      for (let i = 0; i < moreFieldsAndValues.length; i++) {
        if (i % 2 === 0) {
          sanitizedArgs.push(sanitizeDataForFirestore(moreFieldsAndValues[i]));
        } else {
          sanitizedArgs.push(moreFieldsAndValues[i]);
        }
      }
      this.tx.update(docRef, ...sanitizedArgs);
    }
    return this;
  }
  delete(docRef: any) {
    this.tx.delete(docRef);
    return this;
  }
}

// Intercept runTransaction to wrap the transaction object automatically
export const runTransaction = (
  firestoreInstance: any,
  updateFunction: (transaction: any) => Promise<any>,
  options?: any
) => {
  let actualDb = firestoreInstance;
  let actualFn = updateFunction;
  let actualOpts = options;
  if (typeof firestoreInstance === "function") {
    actualDb = original.getFirestore();
    actualFn = firestoreInstance;
    actualOpts = updateFunction;
  }

  return original.runTransaction(actualDb, async (originalTx) => {
    const sanitizedTx = new SanitizedTransaction(originalTx);
    return await actualFn(sanitizedTx);
  }, actualOpts);
};
