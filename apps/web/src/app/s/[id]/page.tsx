import { notFound } from "next/navigation"

interface BugReportPageProps {
  params: Promise<{ id: string }>
}

// Placeholder page for viewing bug reports
// UI will be enhanced in follow-up
export default async function BugReportPage({ params }: BugReportPageProps) {
  const { id } = await params

  if (!id) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="mb-2 font-bold text-3xl">Bug Report</h1>
            <p className="text-muted-foreground">ID: {id}</p>
          </div>

          {/* Placeholder content */}
          <div className="rounded-lg border bg-card p-8">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 text-6xl">🐛</div>
              <h2 className="mb-2 font-semibold text-xl">Bug Report View</h2>
              <p className="max-w-md text-muted-foreground">
                This is a placeholder page for viewing bug reports. The full UI
                will be implemented in a follow-up update.
              </p>
              <div className="mt-6 rounded-lg bg-muted p-4">
                <code className="text-sm">Report ID: {id}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
