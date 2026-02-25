import { env } from "@crikket/env/web"
import { BentoCard, BentoGrid } from "@crikket/ui/components/magicui/bento-grid"
import {
  Camera,
  Check,
  Clock,
  Copy,
  FileText,
  LayoutGrid,
  Link2,
  ListChecks,
  Search,
  Shield,
  TriangleAlert,
  Users,
  Video,
} from "lucide-react"
import type { ReactNode } from "react"

// ---- Shared helpers ----

function MiniChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px]">
      {children}
    </span>
  )
}

function MiniStatChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 font-medium text-[10px]">
      {icon}
      {label}: {value}
    </span>
  )
}

// ---- Bento backgrounds ----

function DashboardBackground() {
  const mockReports = [
    {
      title: "Login button unresponsive on mobile",
      artifact: "Video report",
    },
    {
      title: "Dashboard chart flickers on resize",
      artifact: "Screenshot report",
    },
    {
      title: "Export CSV missing data rows",
      artifact: "Video report",
    },
    {
      title: "Notification bell not clearing",
      artifact: "Screenshot report",
    },
  ]

  return (
    <div className="mask-[linear-gradient(to_top,transparent_10%,#000_100%)] absolute inset-0 flex flex-col gap-2 overflow-hidden p-3 transition-all duration-300 ease-out group-hover:scale-105">
      <div className="space-y-2 rounded-lg border bg-card p-2">
        <div className="flex gap-2">
          <div className="flex h-7 flex-1 items-center gap-1.5 rounded border bg-background px-2">
            <Search className="size-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              Search reports…
            </span>
          </div>
          <div className="flex h-7 items-center gap-1 rounded border bg-background px-2 text-[11px]">
            <LayoutGrid className="size-3" />
            Recent
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <MiniStatChip
            icon={<Video className="size-3" />}
            label="Videos"
            value={2}
          />
          <MiniStatChip
            icon={<Camera className="size-3" />}
            label="Screenshots"
            value={2}
          />
          <MiniStatChip
            icon={<FileText className="size-3" />}
            label="Total"
            value={4}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 overflow-hidden">
        {mockReports.map((report) => (
          <div
            className="overflow-hidden rounded-lg border bg-card"
            key={report.title}
          >
            <div className="flex aspect-video items-center justify-center bg-muted">
              <Video className="size-5 text-muted-foreground/50" />
            </div>
            <div className="space-y-1.5 p-2">
              <p className="line-clamp-1 font-medium text-[11px]">
                {report.title}
              </p>
              <div className="flex flex-wrap gap-1">
                <MiniChip>{report.artifact}</MiniChip>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CaptureBackground() {
  return (
    <div className="mask-[linear-gradient(to_top,transparent_10%,#000_100%)] absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 transition-all duration-300 ease-out group-hover:scale-105">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-border bg-background shadow-sm">
        <div className="absolute inset-0 animate-ping rounded-full bg-destructive/20" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <div className="h-5 w-5 rounded-sm bg-destructive" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs backdrop-blur-sm">
        <Clock className="size-3 text-muted-foreground" />
        <span className="font-mono text-[11px] text-muted-foreground">
          0:12
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 font-medium text-[11px] shadow-sm">
          <Video className="size-3.5 text-primary" />
          Video
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-3 py-2 font-medium text-[11px] text-muted-foreground">
          <Camera className="size-3.5" />
          Screenshot
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Captures screen, console logs &amp; network calls
      </p>
    </div>
  )
}

function ShareBackground() {
  return (
    <div className="mask-[linear-gradient(to_top,transparent_10%,#000_100%)] absolute inset-0 flex flex-col justify-center gap-4 p-6 transition-all duration-300 ease-out group-hover:scale-105">
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Share Bug Report</p>
          <span className="rounded-full border bg-background px-2 py-0.5 font-medium text-[10px]">
            Public
          </span>
        </div>

        <div className="flex gap-2">
          <div className="flex h-8 flex-1 items-center overflow-hidden rounded border bg-muted/50 px-2 text-[11px] text-muted-foreground">
            app.crikket.io/s/abc123xf
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded border bg-background">
            <Copy className="size-3.5" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center justify-center gap-1 rounded-lg border-2 border-primary bg-primary/5 py-1.5 font-medium text-[11px] text-primary">
            <Shield className="size-3" />
            Public
          </div>
          <div className="flex items-center justify-center gap-1 rounded-lg border py-1.5 font-medium text-[11px] text-muted-foreground">
            <Shield className="size-3" />
            Private
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {[
          "Share with your team instantly",
          "Control visibility per report",
          "No login required to view",
        ].map((item) => (
          <div className="flex items-center gap-2 text-[11px]" key={item}>
            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="size-2.5 text-primary" />
            </div>
            <span className="text-muted-foreground">{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamBackground() {
  const planStats = [
    { label: "Plan", value: "Pro" },
    { label: "Bug reports", value: "Unlimited" },
    { label: "Seats", value: "8 / 15 used" },
  ]

  return (
    <div className="mask-[linear-gradient(to_top,transparent_10%,#000_100%)] absolute inset-0 flex flex-col gap-3 overflow-hidden p-4 transition-all duration-300 ease-out group-hover:scale-105">
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="font-semibold text-sm">Workspace</p>
          <div className="flex h-7 items-center gap-1 rounded-lg border bg-background px-2.5 font-medium text-[11px]">
            <Users className="size-3" />
            Team settings
          </div>
        </div>
        <div className="divide-y">
          {planStats.map((item) => (
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              key={item.label}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Check className="size-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[12px]">{item.label}</p>
              </div>
              <span className="rounded-md border bg-background px-2 py-0.5 font-medium text-[10px]">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card px-4 py-3">
        <p className="mb-2 font-medium text-[11px] text-muted-foreground">
          Pending Invitations
        </p>
        <div className="flex items-center gap-3 opacity-60">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed bg-muted">
            <Users className="size-3 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Studio upgrade</p>
            <p className="text-[10px] text-muted-foreground/60">
              Unlock unlimited team members
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReplayBackground() {
  return (
    <div className="mask-[linear-gradient(to_top,transparent_10%,#000_100%)] absolute inset-0 flex flex-col justify-center gap-3 overflow-hidden p-4 transition-all duration-300 ease-out group-hover:scale-105">
      <div className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
        <p className="font-medium text-[11px] text-muted-foreground">Steps</p>
        <div className="space-y-1.5">
          {[
            "click • button.ring-sidebar-ring",
            "navigation • window.pushState",
            "click • #email",
          ].map((step) => (
            <div className="flex items-center gap-1.5 text-[11px]" key={step}>
              <ListChecks className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
        <p className="font-medium text-[11px] text-muted-foreground">Logs</p>
        <div className="space-y-1.5">
          {[
            'Error: request failed for "createCheckoutSession"',
            "warn: retrying fetch (attempt 2)",
          ].map((log) => (
            <div className="flex items-center gap-1.5 text-[11px]" key={log}>
              <TriangleAlert className="size-3 text-muted-foreground" />
              <span className="line-clamp-1 text-muted-foreground">{log}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
        <p className="font-medium text-[11px] text-muted-foreground">
          Network Requests
        </p>
        <div className="space-y-1.5">
          {["POST /api/billing 500", "GET /api/user 200"].map((request) => (
            <div
              className="flex items-center gap-1.5 text-[11px]"
              key={request}
            >
              <Link2 className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">{request}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Feature cards config ----

const features = [
  {
    Icon: LayoutGrid,
    name: "Bug Report Feed",
    description:
      "Keep every bug report in one place for triage and reproduction. Crikket focuses on report context to help your team resolve issues faster.",
    href: env.NEXT_PUBLIC_APP_URL,
    cta: "Review reports",
    background: <DashboardBackground />,
    className: "col-span-3 md:col-span-2",
  },
  {
    Icon: Video,
    name: "One-Click Capture",
    description:
      "Capture issues with video or screenshot in seconds, directly from the browser.",
    href: env.NEXT_PUBLIC_DEMO_URL ?? env.NEXT_PUBLIC_APP_URL,
    cta: "Capture a report",
    background: <CaptureBackground />,
    className: "col-span-3 md:col-span-1",
  },
  {
    Icon: FileText,
    name: "Replay Context Included",
    description:
      "Each report includes reproduction steps, console logs, and network requests to speed up debugging.",
    href: env.NEXT_PUBLIC_DEMO_URL ?? env.NEXT_PUBLIC_APP_URL,
    cta: "View report context",
    background: <ReplayBackground />,
    className: "col-span-3 md:col-span-1",
  },
  {
    Icon: Link2,
    name: "Share Links with Access Control",
    description:
      "Share any report with a single link and choose public or private visibility per report.",
    href: env.NEXT_PUBLIC_DEMO_URL ?? env.NEXT_PUBLIC_APP_URL,
    cta: "Share reports",
    background: <ShareBackground />,
    className: "col-span-3 md:col-span-1",
  },
  {
    Icon: Users,
    name: "Workspaces for Teams",
    description:
      "Invite teammates into shared workspaces, manage access, and collaborate on reports.",
    href: env.NEXT_PUBLIC_APP_URL,
    cta: "Explore plans",
    background: <TeamBackground />,
    className: "col-span-3 md:col-span-1",
  },
]

export function FeaturesSection() {
  return (
    <section
      className="w-full scroll-mt-28 space-y-6 px-4 text-left sm:px-0"
      id="features"
    >
      <div className="space-y-3 text-center">
        <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">
          What Crikket actually does
        </h2>
        <p className="mx-auto max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Capture the bug, attach technical context automatically, and share it
          with the right people fast.
        </p>
      </div>

      <BentoGrid>
        {features.map((feature) => (
          <BentoCard key={feature.name} openInNewTab {...feature} />
        ))}
      </BentoGrid>
    </section>
  )
}
