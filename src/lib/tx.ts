import { type ClientSession, type Db } from "mongodb";

import { getClient, getDb } from "@/lib/db";

type TransactionHandler<T> = (session: ClientSession, db: Db) => Promise<T>;

export async function withTransaction<T>(
  handler: TransactionHandler<T>,
): Promise<T> {
  const client = await getClient();
  const db = getDb();
  const session = client.startSession();

  try {
    session.startTransaction();
    const result = await handler(session, db);
    await session.commitTransaction();
    return result;
  } catch (err) {
    const txErr = err as {
      stack?: unknown;
      code?: unknown;
      message?: unknown;
      meta?: unknown;
    } | null | undefined;

    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch {
      // Ignore abort failure; original failure is more important.
    }

    console.error("TRANSACTION FAILED");
    console.error(err);
    console.error(txErr?.stack);
    console.error(txErr?.code);
    console.error(txErr?.message);
    console.error(txErr?.meta);

    if (err instanceof Response) {
      throw err;
    }

    throw new Error("Transaction failed due to an unexpected server error");
  } finally {
    await session.endSession();
  }
}
