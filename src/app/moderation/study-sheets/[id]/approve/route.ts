import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { moderateStudySheet } from "@/modules/study-sheets/moderation";
import {
  normalizeStudySheet,
  parsePositiveInt,
} from "@/modules/study-sheets/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STAFF", "ADMIN"]);

    const { id } = await params;
    const studySheetId = parsePositiveInt(id);
    if (!studySheetId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const updated = await withTransaction(async (session, db) =>
      moderateStudySheet(db, session, {
        studySheetId,
        actorId: currentUser.userId,
        status: "APPROVED",
      }),
    );

    const response = normalizeStudySheet(updated);
    if (!response) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
