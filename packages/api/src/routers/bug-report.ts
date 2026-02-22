import { createBugReport } from "@crikket/bug-reports/procedures/create-bug-report"
import {
  deleteBugReport,
  deleteBugReportsBulk,
} from "@crikket/bug-reports/procedures/delete-bug-reports"
import { getBugReportById } from "@crikket/bug-reports/procedures/get-bug-report"
import {
  getBugReportDebuggerEvents,
  getBugReportNetworkRequestPayload,
  getBugReportNetworkRequests,
} from "@crikket/bug-reports/procedures/get-bug-report-debugger"
import {
  getBugReportDashboardStats,
  listBugReports,
} from "@crikket/bug-reports/procedures/list-bug-reports"
import {
  updateBugReport,
  updateBugReportsBulk,
  updateBugReportVisibility,
} from "@crikket/bug-reports/procedures/update-bug-reports"

/**
 * Bug Report Router
 * All logic lives in @crikket/bug-reports package modules
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
