import { CardSkeleton } from "@/components/card-skeleton"
import { DashboardHeader } from "@/components/header"
import { DashboardShell } from "@/components/shell"

export default function CrawlersLoading() {
    return (
        <DashboardShell>
            <DashboardHeader
                heading="Dashboard"
                text="Create and manage your chatbots."
            />
            <div className="grid gap-10">
                <CardSkeleton />
            </div>
        </DashboardShell>
    )
}