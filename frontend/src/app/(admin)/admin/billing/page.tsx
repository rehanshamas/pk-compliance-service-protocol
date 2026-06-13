"use client";

import { useEffect, useState } from "react";
import { getBillingPlans, createBillingPlan, apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Trash2, Tag, CreditCard, Users } from "lucide-react";

interface PricingRule {
  id: string;
  service_type: string;
  included_in_plan: boolean;
  price_per_unit: number;
  quota_limit: number;
  overage_price_per_unit: number;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_trial: boolean;
  billing_cycle: string;
  base_price: number;
  is_active: boolean;
  pricing_rules: PricingRule[];
}

interface Coupon {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  description?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  max_uses?: number | null;
  times_used?: number;
  is_active?: boolean;
  plan_ids?: string[];
  created_at?: string;
}

interface Subscription {
  id: string;
  tenant_id?: string;
  tenant_name?: string;
  plan_id?: string;
  plan_name?: string;
  status: string;
  monthly_amount?: number;
  current_period_start?: string;
  current_period_end?: string;
  created_at?: string;
  [key: string]: any;
}

const SERVICE_LABELS: Record<string, string> = {
  kyc: "KYC",
  screening: "Screening",
  analytics_l1: "Analytics L1",
  analytics_l3: "Analytics L3",
  reports: "Reports",
  form_generation: "Forms",
};

const DEFAULT_SERVICES = ["kyc", "screening", "analytics_l1", "analytics_l3", "reports", "form_generation"];

// ─── Plans Tab ────────────────────────────────────────────────────────────────

function PlansTab() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit plan state
  const [editOpen, setEditOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBasePrice, setEditBasePrice] = useState("");
  const [editBillingCycle, setEditBillingCycle] = useState("monthly");
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [editIsTrial, setEditIsTrial] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editRules, setEditRules] = useState<PricingRule[]>([]);
  const [saving, setSaving] = useState(false);

  // Create plan state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createBasePrice, setCreateBasePrice] = useState("");
  const [createBillingCycle, setCreateBillingCycle] = useState("monthly");
  const [createIsDefault, setCreateIsDefault] = useState(false);
  const [createIsTrial, setCreateIsTrial] = useState(false);
  const [createRules, setCreateRules] = useState<Array<{ service_type: string; price_per_unit: number; quota_limit: number; overage_price_per_unit: number; included_in_plan: boolean }>>(
    DEFAULT_SERVICES.map((s) => ({ service_type: s, price_per_unit: 0, quota_limit: 0, overage_price_per_unit: 0, included_in_plan: true }))
  );
  const [creating, setCreating] = useState(false);

  const fetchPlans = () => {
    setLoading(true);
    getBillingPlans()
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openEdit = (plan: Plan) => {
    setEditPlan(plan);
    setEditName(plan.name);
    setEditDescription(plan.description || "");
    setEditBasePrice(String(plan.base_price));
    setEditBillingCycle(plan.billing_cycle);
    setEditIsDefault(plan.is_default);
    setEditIsTrial(plan.is_trial);
    setEditIsActive(plan.is_active);
    setEditRules(plan.pricing_rules.map((r) => ({ ...r })));
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editPlan) return;
    setSaving(true);
    try {
      await apiRequest(`/billing/plans/${editPlan.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          base_price: parseFloat(editBasePrice) || 0,
          billing_cycle: editBillingCycle,
          is_default: editIsDefault,
          is_trial: editIsTrial,
          is_active: editIsActive,
          pricing_rules: editRules.map((r) => ({
            id: r.id,
            service_type: r.service_type,
            included_in_plan: r.included_in_plan,
            price_per_unit: r.price_per_unit,
            quota_limit: r.quota_limit,
            overage_price_per_unit: r.overage_price_per_unit,
          })),
        }),
      });
      toast.success("Plan updated successfully");
      setEditOpen(false);
      fetchPlans();
    } catch (err: any) {
      toast.error("Failed to update plan: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const updateEditRule = (idx: number, field: string, value: any) => {
    setEditRules((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await createBillingPlan({
        name: createName.trim(),
        description: createDescription || null,
        base_price: parseFloat(createBasePrice) || 0,
        billing_cycle: createBillingCycle,
        is_default: createIsDefault,
        is_trial: createIsTrial,
        pricing_rules: createRules,
      });
      toast.success("Plan created successfully");
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateBasePrice("");
      setCreateBillingCycle("monthly");
      setCreateIsDefault(false);
      setCreateIsTrial(false);
      setCreateRules(DEFAULT_SERVICES.map((s) => ({ service_type: s, price_per_unit: 0, quota_limit: 0, overage_price_per_unit: 0, included_in_plan: true })));
      fetchPlans();
    } catch (err: any) {
      toast.error("Failed to create plan: " + (err.message || "Unknown error"));
    } finally {
      setCreating(false);
    }
  };

  const updateCreateRule = (idx: number, field: string, value: any) => {
    setCreateRules((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{plans.length} plan(s)</p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Plan
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="border rounded-lg overflow-hidden">
            <div className="p-4 bg-muted/30 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xl font-bold">PKR {plan.base_price.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground capitalize">{plan.billing_cycle}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 flex gap-2 flex-wrap">
              {plan.is_default && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Default</span>
              )}
              {plan.is_trial && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">Trial</span>
              )}
              {!plan.is_active && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
            <div className="border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/20">
                    <th className="text-left p-2 pl-4 font-medium">Service</th>
                    <th className="text-right p-2 font-medium">Per Unit</th>
                    <th className="text-right p-2 font-medium">Quota</th>
                    <th className="text-right p-2 pr-4 font-medium">Overage</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.pricing_rules.map((rule) => (
                    <tr key={rule.id} className="border-t border-muted/50">
                      <td className="p-2 pl-4">
                        {SERVICE_LABELS[rule.service_type] || rule.service_type}
                        {!rule.included_in_plan && (
                          <span className="ml-1 text-xs text-muted-foreground">(add-on)</span>
                        )}
                      </td>
                      <td className="text-right p-2">PKR {rule.price_per_unit}</td>
                      <td className="text-right p-2">{rule.quota_limit === 0 ? "\u221E" : rule.quota_limit}</td>
                      <td className="text-right p-2 pr-4">PKR {rule.overage_price_per_unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Plan Dialog */}
      <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Plan: {editPlan?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Update plan details and pricing rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <Label>Base Price (PKR)</Label>
                <Input type="number" value={editBasePrice} onChange={(e) => setEditBasePrice(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Billing Cycle</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editBillingCycle}
                  onChange={(e) => setEditBillingCycle(e.target.value)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editIsDefault} onChange={(e) => setEditIsDefault(e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm">Default</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editIsTrial} onChange={(e) => setEditIsTrial(e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm">Trial</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Pricing Rules</Label>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20">
                      <th className="text-left p-2 pl-3 font-medium">Service</th>
                      <th className="text-left p-2 font-medium">Included</th>
                      <th className="text-right p-2 font-medium">Per Unit</th>
                      <th className="text-right p-2 font-medium">Quota</th>
                      <th className="text-right p-2 pr-3 font-medium">Overage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editRules.map((rule, idx) => (
                      <tr key={rule.id || idx} className="border-t">
                        <td className="p-2 pl-3">{SERVICE_LABELS[rule.service_type] || rule.service_type}</td>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={rule.included_in_plan}
                            onChange={(e) => updateEditRule(idx, "included_in_plan", e.target.checked)}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-8 w-24 ml-auto text-right"
                            value={rule.price_per_unit}
                            onChange={(e) => updateEditRule(idx, "price_per_unit", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-8 w-24 ml-auto text-right"
                            value={rule.quota_limit}
                            onChange={(e) => updateEditRule(idx, "quota_limit", parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2 pr-3">
                          <Input
                            type="number"
                            className="h-8 w-24 ml-auto text-right"
                            value={rule.overage_price_per_unit}
                            onChange={(e) => updateEditRule(idx, "overage_price_per_unit", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Plan Dialog */}
      <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Set up a new billing plan with pricing rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Enterprise" />
              </div>
              <div>
                <Label>Base Price (PKR)</Label>
                <Input type="number" value={createBasePrice} onChange={(e) => setCreateBasePrice(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Plan description" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Billing Cycle</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={createBillingCycle}
                  onChange={(e) => setCreateBillingCycle(e.target.value)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createIsDefault} onChange={(e) => setCreateIsDefault(e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm">Default</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createIsTrial} onChange={(e) => setCreateIsTrial(e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm">Trial</span>
                </label>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Pricing Rules</Label>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20">
                      <th className="text-left p-2 pl-3 font-medium">Service</th>
                      <th className="text-left p-2 font-medium">Included</th>
                      <th className="text-right p-2 font-medium">Per Unit</th>
                      <th className="text-right p-2 font-medium">Quota</th>
                      <th className="text-right p-2 pr-3 font-medium">Overage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {createRules.map((rule, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2 pl-3">{SERVICE_LABELS[rule.service_type] || rule.service_type}</td>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={rule.included_in_plan}
                            onChange={(e) => updateCreateRule(idx, "included_in_plan", e.target.checked)}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-8 w-24 ml-auto text-right"
                            value={rule.price_per_unit}
                            onChange={(e) => updateCreateRule(idx, "price_per_unit", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-8 w-24 ml-auto text-right"
                            value={rule.quota_limit}
                            onChange={(e) => updateCreateRule(idx, "quota_limit", parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2 pr-3">
                          <Input
                            type="number"
                            className="h-8 w-24 ml-auto text-right"
                            value={rule.overage_price_per_unit}
                            onChange={(e) => updateCreateRule(idx, "overage_price_per_unit", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Coupons Tab ──────────────────────────────────────────────────────────────

function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Create coupon state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscountType, setCouponDiscountType] = useState<"percent" | "fixed">("percent");
  const [couponDiscountValue, setCouponDiscountValue] = useState("");
  const [couponDescription, setCouponDescription] = useState("");
  const [couponValidFrom, setCouponValidFrom] = useState("");
  const [couponValidUntil, setCouponValidUntil] = useState("");
  const [couponMaxUses, setCouponMaxUses] = useState("");
  const [couponPlanIds, setCouponPlanIds] = useState("");

  // Edit coupon state
  const [editOpen, setEditOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<"percent" | "fixed">("percent");
  const [editDiscountValue, setEditDiscountValue] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editValidUntil, setEditValidUntil] = useState("");
  const [editMaxUses, setEditMaxUses] = useState("");
  const [editPlanIds, setEditPlanIds] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCoupon, setDeleteCoupon] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>("/billing/coupons?active_only=false&limit=100");
      const items = data?.items || (Array.isArray(data) ? data : []);
      setCoupons(items);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const resetCreateForm = () => {
    setCouponCode("");
    setCouponDiscountType("percent");
    setCouponDiscountValue("");
    setCouponDescription("");
    setCouponValidFrom("");
    setCouponValidUntil("");
    setCouponMaxUses("");
    setCouponPlanIds("");
  };

  const handleCreate = async () => {
    if (!couponCode.trim()) return;
    setCreating(true);
    try {
      const body: any = {
        code: couponCode.trim().toUpperCase(),
        discount_type: couponDiscountType,
        discount_value: parseFloat(couponDiscountValue) || 0,
      };
      if (couponDescription) body.description = couponDescription;
      if (couponValidFrom) body.valid_from = couponValidFrom;
      if (couponValidUntil) body.valid_until = couponValidUntil;
      if (couponMaxUses) body.max_uses = parseInt(couponMaxUses) || null;
      if (couponPlanIds.trim()) body.plan_ids = couponPlanIds.split(",").map((s) => s.trim()).filter(Boolean);

      await apiRequest("/billing/coupons", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Coupon created");
      setCreateOpen(false);
      resetCreateForm();
      fetchCoupons();
    } catch (err: any) {
      toast.error("Failed to create coupon: " + (err.message || "Unknown error"));
    } finally {
      setCreating(false);
    }
  };

  const openEditCoupon = (c: Coupon) => {
    setEditCoupon(c);
    setEditCode(c.code);
    setEditDiscountType(c.discount_type);
    setEditDiscountValue(String(c.discount_value));
    setEditDescription(c.description || "");
    setEditValidFrom(c.valid_from ? c.valid_from.slice(0, 10) : "");
    setEditValidUntil(c.valid_until ? c.valid_until.slice(0, 10) : "");
    setEditMaxUses(c.max_uses != null ? String(c.max_uses) : "");
    setEditPlanIds(c.plan_ids?.join(", ") || "");
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editCoupon) return;
    setEditSaving(true);
    try {
      const body: any = {
        code: editCode.trim().toUpperCase(),
        discount_type: editDiscountType,
        discount_value: parseFloat(editDiscountValue) || 0,
        description: editDescription || null,
        valid_from: editValidFrom || null,
        valid_until: editValidUntil || null,
        max_uses: editMaxUses ? parseInt(editMaxUses) : null,
      };
      if (editPlanIds.trim()) body.plan_ids = editPlanIds.split(",").map((s) => s.trim()).filter(Boolean);

      await apiRequest(`/billing/coupons/${editCoupon.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("Coupon updated");
      setEditOpen(false);
      fetchCoupons();
    } catch (err: any) {
      toast.error("Failed to update coupon: " + (err.message || "Unknown error"));
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCoupon) return;
    setDeleting(true);
    try {
      await apiRequest(`/billing/coupons/${deleteCoupon.id}`, { method: "DELETE" });
      toast.success("Coupon deleted");
      setDeleteOpen(false);
      setDeleteCoupon(null);
      fetchCoupons();
    } catch (err: any) {
      toast.error("Failed to delete coupon: " + (err.message || "Unknown error"));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{coupons.length} coupon(s)</p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Coupon
        </Button>
      </div>

      {coupons.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <Tag className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No coupons yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20">
                <th className="text-left p-3 pl-4 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Discount</th>
                <th className="text-left p-3 font-medium">Valid Until</th>
                <th className="text-center p-3 font-medium">Uses</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-right p-3 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-muted/50">
                  <td className="p-3 pl-4 font-mono font-semibold">{c.code}</td>
                  <td className="p-3">
                    {c.discount_type === "percent"
                      ? `${c.discount_value}%`
                      : `PKR ${c.discount_value.toLocaleString()}`}
                    {c.description && (
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : "No expiry"}
                  </td>
                  <td className="p-3 text-center">
                    {c.times_used ?? 0}
                    {c.max_uses ? ` / ${c.max_uses}` : ""}
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant={c.is_active !== false ? "default" : "destructive"}>
                      {c.is_active !== false ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="p-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditCoupon(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteCoupon(c);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Coupon Dialog */}
      <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
        <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Create Coupon</AlertDialogTitle>
            <AlertDialogDescription>Create a new discount coupon code.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code</Label>
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="e.g. LAUNCH50"
                  className="uppercase"
                />
              </div>
              <div>
                <Label>Discount Type</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={couponDiscountType}
                  onChange={(e) => setCouponDiscountType(e.target.value as "percent" | "fixed")}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (PKR)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Value</Label>
                <Input
                  type="number"
                  value={couponDiscountValue}
                  onChange={(e) => setCouponDiscountValue(e.target.value)}
                  placeholder={couponDiscountType === "percent" ? "e.g. 20" : "e.g. 5000"}
                />
              </div>
              <div>
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  value={couponMaxUses}
                  onChange={(e) => setCouponMaxUses(e.target.value)}
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={couponDescription}
                onChange={(e) => setCouponDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valid From</Label>
                <Input type="date" value={couponValidFrom} onChange={(e) => setCouponValidFrom(e.target.value)} />
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input type="date" value={couponValidUntil} onChange={(e) => setCouponValidUntil(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Plan IDs (comma-separated, optional)</Label>
              <Input
                value={couponPlanIds}
                onChange={(e) => setCouponPlanIds(e.target.value)}
                placeholder="Leave empty for all plans"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreate} disabled={creating || !couponCode.trim()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Coupon
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Coupon Dialog */}
      <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
        <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Coupon: {editCoupon?.code}</AlertDialogTitle>
            <AlertDialogDescription>Update coupon details.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code</Label>
                <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} className="uppercase" />
              </div>
              <div>
                <Label>Discount Type</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editDiscountType}
                  onChange={(e) => setEditDiscountType(e.target.value as "percent" | "fixed")}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (PKR)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Value</Label>
                <Input type="number" value={editDiscountValue} onChange={(e) => setEditDiscountValue(e.target.value)} />
              </div>
              <div>
                <Label>Max Uses</Label>
                <Input type="number" value={editMaxUses} onChange={(e) => setEditMaxUses(e.target.value)} placeholder="Unlimited" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valid From</Label>
                <Input type="date" value={editValidFrom} onChange={(e) => setEditValidFrom(e.target.value)} />
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input type="date" value={editValidUntil} onChange={(e) => setEditValidUntil(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Plan IDs (comma-separated)</Label>
              <Input value={editPlanIds} onChange={(e) => setEditPlanIds(e.target.value)} placeholder="Leave empty for all plans" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete coupon <strong>{deleteCoupon?.code}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────

function SubscriptionsTab() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>("/billing/subscriptions");
      const items = data?.items || (Array.isArray(data) ? data : []);
      setSubscriptions(items);
    } catch {
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const getStatusVariant = (status: string): "default" | "destructive" | "secondary" => {
    if (status === "active" || status === "trialing") return "default";
    if (status === "past_due" || status === "suspended") return "secondary";
    if (status === "cancelled" || status === "canceled") return "destructive";
    return "secondary";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No subscriptions found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{subscriptions.length} subscription(s)</p>
        <Button variant="outline" size="sm" onClick={fetchSubscriptions}>
          <Loader2 className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/20">
              <th className="text-left p-3 pl-4 font-medium">Tenant</th>
              <th className="text-left p-3 font-medium">Plan</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Monthly Amount</th>
              <th className="text-left p-3 pr-4 font-medium">Period</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="border-t border-muted/50">
                <td className="p-3 pl-4">
                  <p className="font-medium">{sub.tenant_name || sub.tenant_id || "-"}</p>
                </td>
                <td className="p-3 text-muted-foreground">
                  {sub.plan_name || sub.plan_id || "-"}
                </td>
                <td className="p-3 text-center">
                  <Badge variant={getStatusVariant(sub.status)}>
                    {sub.status}
                  </Badge>
                </td>
                <td className="p-3 text-right font-medium">
                  {sub.monthly_amount != null ? `PKR ${sub.monthly_amount.toLocaleString()}` : "-"}
                </td>
                <td className="p-3 pr-4 text-xs text-muted-foreground">
                  {sub.current_period_start
                    ? `${new Date(sub.current_period_start).toLocaleDateString()} - ${sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "..."}`
                    : sub.created_at
                      ? `Since ${new Date(sub.created_at).toLocaleDateString()}`
                      : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Billing Management</h1>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">
            <CreditCard className="mr-2 h-4 w-4" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="coupons">
            <Tag className="mr-2 h-4 w-4" />
            Coupons
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <Users className="mr-2 h-4 w-4" />
            Subscriptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <PlansTab />
        </TabsContent>

        <TabsContent value="coupons">
          <CouponsTab />
        </TabsContent>

        <TabsContent value="subscriptions">
          <SubscriptionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
