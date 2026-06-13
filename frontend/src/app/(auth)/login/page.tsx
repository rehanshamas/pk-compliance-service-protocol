"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { loginApi, storeAuth, isAdminRole } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(4, "Password must be at least 4 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError("");
    try {
      const res = await loginApi(data.email.trim(), data.password);
      storeAuth(res.user, {
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
      });
      router.push(isAdminRole(res.user.role) ? "/admin/tenants" : "/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <Card className="overflow-hidden shadow-lg card-green-top">
      <div className="bg-primary/5 dark:bg-primary/10 px-6 py-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Sign in to CIP</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compliance Infrastructure Platform
        </p>
      </div>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="mlro@vasp.pk"
              className={`h-11 fi-green ${errors.email ? "border-destructive" : ""}`}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className={`h-11 fi-green ${errors.password ? "border-destructive" : ""}`}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Demo: mlro@vasp.pk / demo123 (MLRO) or admin@cip.pk / admin123 (Admin)
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t pt-4 text-[11px] text-muted-foreground">
          <span>Bank-grade security</span>
          <span>•</span>
          <span>SOC 2 compliant</span>
        </div>
        <div className="mt-3 text-center">
          <Link
            href="/apply"
            className="text-sm text-primary hover:underline"
          >
            New VASP? Apply for CIP
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
