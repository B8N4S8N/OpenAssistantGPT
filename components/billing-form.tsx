"use client"

import { useState } from "react"

import { UserSubscriptionPlan } from "@/types"
import { cn } from "@/lib/utils"
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { CardContent, CardFooter } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import { buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"

interface BillingFormProps extends React.HTMLAttributes<HTMLFormElement> {
    subscriptionPlan: UserSubscriptionPlan & {
        isCanceled: boolean
    }
}

export function BillingForm({
    subscriptionPlan,
    className,
    ...props
}: BillingFormProps) {
    const [isLoading, setIsLoading] = useState<boolean>(false)

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(!isLoading)

        // Get a Stripe session URL.
        const response = await fetch("/api/users/stripe")

        if (!response?.ok) {
            return toast({
                title: "Something went wrong.",
                description: "Please refresh the page and try again.",
                variant: "destructive",
            })
        }

        // Redirect to the Stripe session.
        // This could be a checkout page for initial upgrade.
        // Or portal to manage existing subscription.
        const session = await response.json()
        if (session) {
            window.location.href = session.url
        }
    }



    return (
        <form className={cn(className)} {...props}>
            <Card>
                <CardHeader>
                    <CardTitle>Subscription Plan</CardTitle>
                    <CardDescription>
                        You are currently on the <strong>{subscriptionPlan.name}</strong>{" "}
                        plan.
                    </CardDescription>
                </CardHeader>
                <CardContent>{subscriptionPlan.description}</CardContent>
                <CardFooter className="flex flex-col items-start space-y-2 md:flex-row md:justify-between md:space-x-0">
                    <button
                        onClick={onSubmit}
                        type="submit"
                        className={cn(buttonVariants())}
                        disabled={isLoading}
                    >
                        {isLoading && (
                            <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {subscriptionPlan.isPro ? "Manage Subscription" : "Upgrade to PRO"}
                    </button>
                    {subscriptionPlan.isPro ? (
                        <p className="rounded-full text-xs font-medium">
                            {subscriptionPlan.isCanceled
                                ? "Your plan will be canceled on "
                                : "Your plan renews on "}
                            {formatDate(subscriptionPlan.stripeCurrentPeriodEnd)}.
                        </p>
                    ) : null}
                </CardFooter>
            </Card>

        </form>
    )
}