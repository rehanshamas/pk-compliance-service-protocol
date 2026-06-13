"use client";

import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import {
  Check,
  Star,
} from "lucide-react";

const plans = [
  {
    name: "Trial",
    price: "PKR 0",
    period: "14 days",
    description: "14-day free trial. 10 calls per service.",
    badge: "Free Trial",
    badgeClass: "bg-green-500/10 text-green-500",
    popular: false,
    cta: "Start Free Trial",
    ctaVariant: "outline" as const,
    quotas: {
      kyc: "10",
      screening: "10",
      analyticsL1: "10",
      analyticsL3: "10",
      reports: "10",
      forms: "10",
    },
    overages: {
      kyc: "Free",
      screening: "Free",
      analyticsL1: "Free",
      analyticsL3: "Free",
      reports: "Free",
      forms: "Free",
    },
    features: [
      "10 KYC verifications",
      "10 screening checks",
      "10 analytics queries",
      "ISAR + STR workflow",
      "1 team member",
      "Email support",
    ],
  },
  {
    name: "Starter",
    price: "PKR 25,000",
    period: "/ month",
    description: "For VASPs beginning operations.",
    badge: null,
    badgeClass: "",
    popular: false,
    cta: "Get Started",
    ctaVariant: "outline" as const,
    quotas: {
      kyc: "500",
      screening: "1,000",
      analyticsL1: "500",
      analyticsL3: "50",
      reports: "Included",
      forms: "Included",
    },
    overages: {
      kyc: "PKR 50",
      screening: "PKR 20",
      analyticsL1: "PKR 10",
      analyticsL3: "PKR 500",
      reports: "PKR 200",
      forms: "PKR 100",
    },
    features: [
      "500 KYC verifications",
      "1,000 screening checks",
      "500 analytics (L1+L2)",
      "50 L3 deep investigations",
      "ISAR + STR/CTR + Forms",
      "2 team members",
    ],
  },
  {
    name: "Professional",
    price: "PKR 75,000",
    period: "/ month",
    description: "For growing VASPs with active compliance.",
    badge: null,
    badgeClass: "",
    popular: true,
    cta: "Get Started",
    ctaVariant: "default" as const,
    quotas: {
      kyc: "2,000",
      screening: "5,000",
      analyticsL1: "2,000",
      analyticsL3: "200",
      reports: "Included",
      forms: "Included",
    },
    overages: {
      kyc: "PKR 35",
      screening: "PKR 15",
      analyticsL1: "PKR 7",
      analyticsL3: "PKR 400",
      reports: "PKR 150",
      forms: "PKR 75",
    },
    features: [
      "2,000 KYC verifications",
      "5,000 screening checks",
      "2,000 analytics (L1+L2)",
      "200 L3 deep investigations",
      "Full compliance suite",
      "5 team members",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "PKR 200,000",
    period: "/ month",
    description: "Unlimited quotas. Dedicated support.",
    badge: null,
    badgeClass: "",
    popular: false,
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
    quotas: {
      kyc: "Unlimited",
      screening: "Unlimited",
      analyticsL1: "Unlimited",
      analyticsL3: "Unlimited",
      reports: "Unlimited",
      forms: "Unlimited",
    },
    overages: {
      kyc: "PKR 25",
      screening: "PKR 10",
      analyticsL1: "PKR 5",
      analyticsL3: "PKR 300",
      reports: "PKR 100",
      forms: "PKR 50",
    },
    features: [
      "Unlimited KYC",
      "Unlimited screening",
      "Unlimited analytics",
      "Unlimited L3",
      "Custom integrations",
      "Unlimited team",
      "Dedicated account manager",
    ],
  },
];

const overageRows = [
  { service: "KYC Verification", key: "kyc" as const },
  { service: "Screening", key: "screening" as const },
  { service: "Analytics L1", key: "analyticsL1" as const },
  { service: "Analytics L3", key: "analyticsL3" as const },
  { service: "Reports", key: "reports" as const },
  { service: "Forms", key: "forms" as const },
];

export default function PricingPage() {
  return (
    <PublicShell>
      {/* Hero */}
      <section className="pt-24 pb-16 px-6">
        <div className="container max-w-5xl mx-auto text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Transparent pricing for every stage
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Start free, scale as you grow. All prices in PKR. No hidden fees.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-16">
        <div className="container max-w-5xl mx-auto">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative card-animated rounded-xl border bg-card p-6 ${
                  plan.popular
                    ? "border-primary shadow-md ring-1 ring-primary/20"
                    : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                      <Star className="h-3 w-3" /> Most Popular
                    </span>
                  </div>
                )}

                <div className="text-base font-bold">{plan.name}</div>
                <p className="text-xs text-muted-foreground mt-1 min-h-[2rem]">
                  {plan.description}
                </p>

                <div className="mt-4 mb-1">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    {plan.period}
                  </span>
                </div>

                {plan.badge && (
                  <span
                    className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mt-1 ${plan.badgeClass}`}
                  >
                    {plan.badge}
                  </span>
                )}

                <ul className="mt-4 space-y-0">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-muted-foreground py-1.5 border-t"
                    >
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href={plan.cta === "Contact Sales" ? "/docs/contact" : "/apply"}>
                  <Button
                    variant={plan.ctaVariant}
                    className="w-full mt-4"
                    size="sm"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed per-service pricing table */}
      <section className="px-6 pb-20">
        <div className="container max-w-5xl mx-auto">
          <div className="card-animated rounded-xl border bg-card p-6">
            <h3 className="text-lg font-semibold mb-1">
              Detailed per-service pricing
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Every plan includes a base quota. Overages are billed per-unit at
              the rates below.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2 px-2 border-b">
                      Service
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.name}
                        className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2 px-2 border-b"
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overageRows.map((row) => (
                    <tr key={row.key}>
                      <td className="py-2 px-2 font-medium border-b text-muted-foreground">
                        {row.service}
                      </td>
                      {plans.map((plan) => (
                        <td
                          key={plan.name}
                          className="text-right py-2 px-2 border-b text-muted-foreground"
                        >
                          {plan.name === "Trial"
                            ? `Free x ${plan.quotas[row.key]}`
                            : plan.overages[row.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Need custom pricing?{" "}
            <Link
              href="/docs/contact"
              className="text-primary hover:underline"
            >
              Contact us
            </Link>{" "}
            for Enterprise and volume deals.
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
