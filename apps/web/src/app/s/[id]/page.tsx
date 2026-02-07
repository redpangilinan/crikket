import { notFound } from "next/navigation"
import { BugReportView } from "./_components/bug-report-view"

interface BugReportPageProps {
  params: Promise<{ id: string }>
}

export default async function BugReportPage({ params }: BugReportPageProps) {
  const { id } = await params

  if (!id) {
    notFound()
  }

  return <BugReportView id={id} />
}
