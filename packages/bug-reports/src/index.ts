// Bug Reports Package
// Main entry point for bug report procedures and utilities

export {
  type BugReportDashboardStats,
  type BugReportListItem,
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
} from "./procedures"

export {
  createLocalStorageProvider,
  createS3StorageProvider,
  extractStorageKeyFromUrl,
  generateFilename,
  getStorageProvider,
  type StorageProvider,
} from "./storage"
