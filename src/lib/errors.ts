export const genericErrorMessage = "Something went wrong. Try again.";

/**
 * SQLSTATE codes the group functions raise deliberately, each with a message
 * written for the player in the migration.
 */
const applicationErrorCodes = new Set(["28000", "22023", "42501", "23514"]);

type DatabaseError = {
  message: string;
  code?: string;
  details?: string | null;
};

/**
 * Postgres reuses these codes for its own errors, so the code alone is not
 * enough. A violated CHECK constraint is also 23514, and its `details` carry
 * the failing row. The migration's RAISE statements never set details, so an
 * error with details is Postgres talking and is reported generically.
 */
export function userFacingMessage(error: DatabaseError): string {
  if (
    error.code &&
    applicationErrorCodes.has(error.code) &&
    !error.details &&
    error.message
  ) {
    return error.message;
  }

  return genericErrorMessage;
}
