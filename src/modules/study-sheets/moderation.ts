import { type ClientSession } from "mongodb";

import { apiError } from "@/lib/errors";
import { getNextSequenceValue, type StudySheetDoc } from "@/modules/study-sheets/utils";

type AuditLogDoc = {
  id?: unknown;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  amount?: number;
  createdAt: Date;
};

type StudySheetApprovalDoc = {
  id?: unknown;
  studySheetId: number;
  reviewerId: number;
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function moderateStudySheet(
  db: {
    collection: <T = unknown>(name: string) => {
      findOne: (filter: Record<string, unknown>, options?: { session?: ClientSession }) => Promise<T | null>;
      findOneAndUpdate: (
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
        options?: { returnDocument?: "before" | "after"; session?: ClientSession },
      ) => Promise<T | null>;
      updateOne: (
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
        options?: { upsert?: boolean; session?: ClientSession },
      ) => Promise<unknown>;
      insertOne: (doc: Record<string, unknown>, options?: { session?: ClientSession }) => Promise<unknown>;
    };
  },
  session: ClientSession,
  input: {
    studySheetId: number;
    actorId: number;
    status: "APPROVED" | "REJECTED";
    reason: string | null;
  },
): Promise<StudySheetDoc> {
  const studySheets = db.collection<StudySheetDoc>("study_sheets");
  const approvals = db.collection<StudySheetApprovalDoc>("study_sheet_approvals");
  const auditLogs = db.collection<AuditLogDoc>("audit_logs");

  const existing = await studySheets.findOne({ id: input.studySheetId }, { session });
  if (!existing) {
    throw apiError(404, "Study sheet not found", "Not Found");
  }

  const now = new Date();
  const updated = await studySheets.findOneAndUpdate(
    { id: input.studySheetId },
    {
      $set: {
        status: input.status,
        updatedAt: now,
      },
    },
    { returnDocument: "after", session },
  );

  if (!updated) {
    throw apiError(404, "Study sheet not found", "Not Found");
  }

  const approvalId = await getNextSequenceValue("study_sheet_approvals", session);
  await approvals.updateOne(
    { studySheetId: input.studySheetId },
    {
      $setOnInsert: {
        id: approvalId,
        studySheetId: input.studySheetId,
        createdAt: now,
      },
      $set: {
        reviewerId: input.actorId,
        decision: input.status,
        reason: input.reason,
        updatedAt: now,
      },
    },
    { upsert: true, session },
  );

  const amount =
    typeof updated.priceCents === "number" && Number.isInteger(updated.priceCents)
      ? updated.priceCents
      : 0;

  const auditId = await getNextSequenceValue("audit_logs", session);
  await auditLogs.insertOne(
    {
      id: auditId,
      actorId: input.actorId,
      action:
        input.status === "APPROVED"
          ? "STUDY_SHEET_APPROVED"
          : "STUDY_SHEET_REJECTED",
      entityType: "STUDY_SHEET",
      entityId: input.studySheetId,
      amount,
      createdAt: now,
    },
    { session },
  );

  return updated;
}
