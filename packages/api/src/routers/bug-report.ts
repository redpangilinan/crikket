import {
  createBugReport,
  deleteBugReport,
  deleteBugReportsBulk,
  getBugReportById,
  getBugReportDebuggerEvents,
  getBugReportNetworkRequestPayload,
  getBugReportNetworkRequests,
  listBugReports,
  updateBugReportVisibility,
} from "@crikket/bug-reports"

/**
 * Bug Report Router
 * All logic lives in @crikket/bug-reports package
 */
export const bugReportRouter = {
  list: listBugReports,
  create: createBugReport,
  getById: getBugReportById,
  getDebuggerEvents: getBugReportDebuggerEvents,
  getNetworkRequests: getBugReportNetworkRequests,
  getNetworkRequestPayload: getBugReportNetworkRequestPayload,
  delete: deleteBugReport,
  deleteBulk: deleteBugReportsBulk,
  updateVisibility: updateBugReportVisibility,
}
