export async function guardedWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error("❌ WRITE FAILED:", {
      code: error?.code,
      message: error?.message
    });
    throw error;
  }
}
