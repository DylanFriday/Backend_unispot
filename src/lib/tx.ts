import { type ClientSession, type Db } from "mongodb";

import { getClient, getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";

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
  } catch (error) {
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch {
      // Ignore abort failure; original failure is more important.
    }

    if (error instanceof Response) {
      throw error;
    }

    throw apiError(
      500,
      "Transaction failed due to an unexpected server error",
      "Internal Server Error",
    );
  } finally {
    await session.endSession();
  }
}
