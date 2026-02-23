import { NextResponse } from "next/server";

const ERROR_NAME_BY_STATUS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
};

export function apiError(
  statusCode: number,
  message: string,
  errorName?: string,
): NextResponse {
  return NextResponse.json(
    {
      statusCode,
      message,
      error: errorName ?? ERROR_NAME_BY_STATUS[statusCode] ?? "Error",
    },
    { status: statusCode },
  );
}
