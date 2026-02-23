import { type ClientSession } from "mongodb";

import { apiError } from "@/lib/errors";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { type LeaseListingDoc } from "@/modules/lease-listings/utils";

type LeaseApprovalDoc = {
  id?: unknown;
  leaseListingId: number;
  reviewerId: number;
  decision: "APPROVED" | "REJECTED";
  reason?: string | null;
  createdAt: Date;
};

type AuditLogDoc = {
  id?: unknown;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  createdAt: Date;
};

export async function moderateLeaseListing(
  db: {
    collection: <T = unknown>(name: string) => {
      findOne: (filter: Record<string, unknown>, options?: { session?: ClientSession }) => Promise<T | null>;
      findOneAndUpdate: (
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
        options?: { returnDocument?: "before" | "after"; session?: ClientSession },
      ) => Promise<T | null>;
      deleteOne: (
        filter: Record<string, unknown>,
        options?: { session?: ClientSession },
      ) => Promise<unknown>;
      insertOne: (doc: Record<string, unknown>, options?: { session?: ClientSession }) => Promise<unknown>;
    };
  },
  session: ClientSession,
  input: {
    leaseListingId: number;
    actorId: number;
    status: "APPROVED" | "REJECTED";
    reason: string | null;
  },
): Promise<LeaseListingDoc> {
  const leaseListings = db.collection<LeaseListingDoc>("lease_listings");
  const leaseApprovals = db.collection<LeaseApprovalDoc>("lease_approvals");
  const auditLogs = db.collection<AuditLogDoc>("audit_logs");

  const existing = await leaseListings.findOne({ id: input.leaseListingId }, { session });
  if (!existing) {
    throw apiError(404, "Lease listing not found", "Not Found");
  }

  const now = new Date();
  const updated = await leaseListings.findOneAndUpdate(
    { id: input.leaseListingId },
    {
      $set: {
        status: input.status,
        updatedAt: now,
      },
    },
    { returnDocument: "after", session },
  );
  if (!updated) {
    throw apiError(404, "Lease listing not found", "Not Found");
  }

  await leaseApprovals.deleteOne({ leaseListingId: input.leaseListingId }, { session });
  const approvalId = await getNextSequenceValue("lease_approvals", session);
  await leaseApprovals.insertOne(
    {
      id: approvalId,
      leaseListingId: input.leaseListingId,
      reviewerId: input.actorId,
      decision: input.status,
      reason: input.reason,
      createdAt: now,
    },
    { session },
  );

  const auditId = await getNextSequenceValue("audit_logs", session);
  await auditLogs.insertOne(
    {
      id: auditId,
      actorId: input.actorId,
      action:
        input.status === "APPROVED"
          ? "LEASE_LISTING_APPROVED"
          : "LEASE_LISTING_REJECTED",
      entityType: "LEASE_LISTING",
      entityId: input.leaseListingId,
      createdAt: now,
    },
    { session },
  );

  return updated;
}
