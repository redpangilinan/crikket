import {
  createBugReport,
  deleteBugReport,
  deleteBugReportsBulk,
  getBugReportById,
  getBugReportDashboardStats,
  getBugReportDebuggerEvents,
  getBugReportNetworkRequestPayload,
  getBugReportNetworkRequests,
  listBugReports,
  updateBugReport,
  updateBugReportsBulk,
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
  getDashboardStats: getBugReportDashboardStats,
  delete: deleteBugReport,
  deleteBulk: deleteBugReportsBulk,
  update: updateBugReport,
  updateBulk: updateBugReportsBulk,
  updateVisibility: updateBugReportVisibility,
}
