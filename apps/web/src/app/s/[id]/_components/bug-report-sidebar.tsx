import { Separator } from "@crikket/ui/components/ui/separator"
import { cn } from "@crikket/ui/lib/utils"
import { Globe, Info, MousePointerClick, Terminal } from "lucide-react"
import type { ReactNode } from "react"

import { TimelineList } from "./timeline-list"
import type {
  DebuggerTimelineEntry,
  DeviceInfo,
  SharedBugReport,
} from "./types"

export type SidebarTab = "details" | "console" | "network" | "actions"

interface BugReportSidebarProps {
  data: SharedBugReport
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  actionEntries: DebuggerTimelineEntry[]
  logEntries: DebuggerTimelineEntry[]
  networkEntries: DebuggerTimelineEntry[]
  activeEntryId: string | null
  onEntrySelect: (entry: DebuggerTimelineEntry) => void
}

export function BugReportSidebar({
  data,
  activeTab,
  onTabChange,
  actionEntries,
  logEntries,
  networkEntries,
  activeEntryId,
  onEntrySelect,
}: BugReportSidebarProps) {
  const deviceInfo = data.deviceInfo as DeviceInfo | null

  return (
    <div className="z-20 flex h-full w-full max-w-[400px] flex-col border-l bg-background shadow-xl md:relative md:top-0 md:shadow-none">
      {/* Tabs Navigation */}
      <div className="flex items-center border-b px-1 py-1">
        <TabButton
          active={activeTab === "details"}
          icon={<Info className="h-3.5 w-3.5" />}
          label="Details"
          onClick={() => onTabChange("details")}
        />
        <TabButton
          active={activeTab === "actions"}
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          label="Steps"
          onClick={() => onTabChange("actions")}
        />
        <TabButton
          active={activeTab === "console"}
          icon={<Terminal className="h-3.5 w-3.5" />}
          label="Console"
          onClick={() => onTabChange("console")}
        />
        <TabButton
          active={activeTab === "network"}
          icon={<Globe className="h-3.5 w-3.5" />}
          label="Network"
          onClick={() => onTabChange("network")}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "details" && (
          <div className="space-y-6 p-4">
            <div className="space-y-4">
              <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Isolate Context
              </h3>
              <div className="grid gap-3 text-sm">
                <DetailRow label="URL" truncate value={data.url} />
                <DetailRow label="Browser" value={deviceInfo?.browser} />
                <DetailRow label="OS" value={deviceInfo?.os} />
                <DetailRow label="Viewport" value={deviceInfo?.viewport} />
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Ticket Info
              </h3>
              <div className="grid gap-3 text-sm">
                <DetailRow label="Priority" value={data.priority} />
                <DetailRow
                  label="Reporter"
                  value={data.reporter?.name ?? "Unknown"}
                />
                <DetailRow label="Org" value={data.organization.name} />
                <div className="pt-2">
                  <span className="mb-1 block font-medium text-muted-foreground text-xs">
                    Description
                  </span>
                  <p className="min-h-[60px] whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-foreground text-sm leading-relaxed">
                    {data.description || "No description provided."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "actions" && (
          <TimelineList
            activeId={activeEntryId}
            emptyMessage="No user actions captured."
            entries={actionEntries}
            icon={<MousePointerClick className="h-3 w-3" />}
            onSelect={onEntrySelect}
          />
        )}

        {activeTab === "console" && (
          <TimelineList
            activeId={activeEntryId}
            emptyMessage="No console logs captured."
            entries={logEntries}
            icon={<Terminal className="h-3 w-3" />}
            onSelect={onEntrySelect}
          />
        )}

        {activeTab === "network" && (
          <TimelineList
            activeId={activeEntryId}
            emptyMessage="No network requests captured."
            entries={networkEntries}
            icon={<Globe className="h-3 w-3" />}
            onSelect={onEntrySelect}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-[4px] py-1.5 font-medium text-xs transition-all",
        active
          ? "bg-muted text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  )
}

function DetailRow({
  label,
  value,
  truncate,
}: {
  label: string
  value?: string | null
  truncate?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      <span
        className={cn(
          "break-words text-foreground text-sm",
          truncate && "truncate"
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
