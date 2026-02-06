import {
  createBugReport,
  getBugReportById,
  listBugReports,
} from "@crikket/bug-reports"

/**
 * Bug Report Router
 * All logic lives in @crikket/bug-reports package
 */
export const bugReportRouter = {
  list: listBugReports,
  create: createBugReport,
  getById: getBugReportById,
}
