import {
  deleteBugReport,
  deleteBugReportsBulk,
} from "@crikket/bug-reports/procedures/delete-bug-reports"
import { exportBugReportDiagnostics } from "@crikket/bug-reports/procedures/export-bug-report"
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
import {
  createBugReportUpload,
  finalizeBugReportUploadProcedure,
  retryBugReportDebuggerIngestionProcedure,
} from "@crikket/bug-reports/procedures/upload-bug-report"
/**
 * Bug Report Router
 * All logic lives in @crikket/bug-reports package modules
 */
export const bugReportRouter = {
  list: listBugReports,
  createUpload: createBugReportUpload,
  finalizeUpload: finalizeBugReportUploadProcedure,
  retryDebuggerIngestion: retryBugReportDebuggerIngestionProcedure,
  getById: getBugReportById,
  getDebuggerEvents: getBugReportDebuggerEvents,
  getNetworkRequests: getBugReportNetworkRequests,
  getNetworkRequestPayload: getBugReportNetworkRequestPayload,
  getDashboardStats: getBugReportDashboardStats,
  exportDiagnostics: exportBugReportDiagnostics,
  delete: deleteBugReport,
  deleteBulk: deleteBugReportsBulk,
  update: updateBugReport,
  updateBulk: updateBugReportsBulk,
  updateVisibility: updateBugReportVisibility,
}
