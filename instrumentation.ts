import type { Instrumentation } from "next";

import {
  createServerErrorEvent,
  reportErrorEvent,
} from "@/src/lib/observability/error-report";

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  reportErrorEvent(createServerErrorEvent(error, request, context));
};
