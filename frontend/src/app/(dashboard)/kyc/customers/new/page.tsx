"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomer } from "@/lib/kyc-api";
import { ArrowLeft } from "lucide-react";

export default function KycNewCustomerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [cnicNumber, setCnicNumber] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("PK");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const customer = await createCustomer({
        full_name: fullName.trim(),
        external_ref: externalRef.trim() || undefined,
        cnic_number: cnicNumber.trim() || undefined,
        dob: dob || undefined,
        nationality: nationality || undefined,
      });
      router.push(`/kyc/customers/${customer.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Add Customer</h1>
        <p className="text-muted-foreground">
          Start KYC verification for a new customer
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
          <CardDescription>
            Enter basic information to begin the KYC process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Muhammad Ali Khan"
                  required
                />
              </div>
              <div>
                <Label htmlFor="externalRef">External Reference (optional)</Label>
                <Input
                  id="externalRef"
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  placeholder="VASP internal ID"
                />
              </div>
              <div>
                <Label htmlFor="cnicNumber">CNIC Number</Label>
                <Input
                  id="cnicNumber"
                  value={cnicNumber}
                  onChange={(e) => setCnicNumber(e.target.value)}
                  placeholder="35201-1234567-8"
                />
              </div>
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <select
                  id="nationality"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                >
                  <option value="PK">Pakistan</option>
                  <option value="AE">UAE</option>
                  <option value="SA">Saudi Arabia</option>
                  <option value="GB">United Kingdom</option>
                  <option value="US">United States</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create & Start KYC"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
