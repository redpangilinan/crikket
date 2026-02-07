import {
  createBugReport,
  deleteBugReport,
  deleteBugReportsBulk,
  getBugReportById,
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
  delete: deleteBugReport,
  deleteBulk: deleteBugReportsBulk,
  updateVisibility: updateBugReportVisibility,
}
