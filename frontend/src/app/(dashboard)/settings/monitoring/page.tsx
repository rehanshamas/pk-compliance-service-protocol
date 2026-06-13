"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/tables/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { HelpCircle, Pencil, Trash2 } from "lucide-react";

const TYPE_HELP: Record<string, { description: string; example: string }> = {
  threshold: {
    description: "Triggers when a single transaction exceeds a specified amount. Use for CTR-style limits (e.g. PKR 2M).",
    example: '{"amount_gt": 2000000, "currency": "PKR"}',
  },
  velocity: {
    description: "Triggers when transaction count or total volume within a time window exceeds limits. Use for rapid cycling, structuring, or burst activity.",
    example: '{"count_gt": 10, "window_hours": 24, "amount_total_gt": 5000000}',
  },
  pattern: {
    description: "Triggers on behavioral patterns such as mixer/tumbler exposure, hawala indicators, dormancy, or known typologies.",
    example: '{"indicator": "mixer_exposure", "min_confidence": 0.7}',
  },
};

/** Field reference and templates for conditions JSON — used by the Conditions guide popup */
const CONDITIONS_GUIDE = {
  threshold: {
    fields: [
      { name: "amount_gt", type: "number", desc: "Alert when a single transaction exceeds this amount. Use smallest unit (e.g. paisa for PKR)." },
      { name: "amount_lt", type: "number", desc: "Alert when a single transaction is below this (e.g. micro-structuring)." },
      { name: "amount_gte", type: "number", desc: "Greater than or equal." },
      { name: "amount_lte", type: "number", desc: "Less than or equal." },
      { name: "currency", type: "string", desc: "ISO 4217 code (PKR, USD). Omit for any currency." },
    ],
    templates: [
      { label: "PKR 2M (CTR threshold)", json: '{"amount_gt": 2000000, "currency": "PKR"}' },
      { label: "USD 10K threshold", json: '{"amount_gt": 10000, "currency": "USD"}' },
      { label: "Any currency 5M", json: '{"amount_gt": 5000000}' },
      { label: "Micro-structuring (< 500K PKR)", json: '{"amount_lt": 500000, "currency": "PKR"}' },
    ],
  },
  velocity: {
    fields: [
      { name: "count_gt", type: "number", desc: "Alert when transaction count in the window exceeds this." },
      { name: "count_gte", type: "number", desc: "At least N transactions in window." },
      { name: "window_hours", type: "number", desc: "Time window in hours (24 = daily, 168 = weekly). Required." },
      { name: "amount_total_gt", type: "number", desc: "Alert when total volume in window exceeds this." },
      { name: "amount_total_lt", type: "number", desc: "Total volume below threshold (e.g. structuring)." },
      { name: "currency", type: "string", desc: "Optional. Restrict to this currency." },
    ],
    templates: [
      { label: "10+ txs in 24h (rapid cycling)", json: '{"count_gt": 10, "window_hours": 24}' },
      { label: "5M+ volume in 24h", json: '{"window_hours": 24, "amount_total_gt": 5000000}' },
      { label: "Rapid cycling (10 tx, 5M, 24h)", json: '{"count_gt": 10, "window_hours": 24, "amount_total_gt": 5000000}' },
      { label: "Burst in 1h (5+ txs)", json: '{"count_gt": 5, "window_hours": 1}' },
    ],
  },
  pattern: {
    fields: [
      { name: "indicator", type: "string", desc: "Built-in indicators: mixer_exposure, hawala_flow, structuring, dormancy, counterparty_cluster." },
      { name: "typology", type: "string", desc: "Alternative to indicator. Known typology name (structuring, capital_flight, etc.)." },
      { name: "min_confidence", type: "number", desc: "0–1. Minimum model confidence to trigger (e.g. 0.7 = 70%). Default 0.5." },
    ],
    templates: [
      { label: "Mixer/tumbler exposure", json: '{"indicator": "mixer_exposure", "min_confidence": 0.7}' },
      { label: "Hawala flow pattern", json: '{"indicator": "hawala_flow", "min_confidence": 0.6}' },
      { label: "Structuring detection", json: '{"indicator": "structuring", "min_confidence": 0.75}' },
      { label: "Dormancy (sudden activity)", json: '{"indicator": "dormancy", "min_confidence": 0.65}' },
    ],
  },
} as const;

function getSeverityVariant(s: string): "success" | "warning" | "danger" | "secondary" {
  if (s === "critical") return "danger";
  if (s === "high") return "danger";
  if (s === "medium") return "warning";
  return "secondary";
}

interface MonitoringRule {
  id: string;
  tenantId: string | null;
  name: string;
  description?: string | null;
  ruleType: string;
  conditions: Record<string, unknown>;
  severity: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsMonitoringPage() {
  const [rules, setRules] = useState<MonitoringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"threshold" | "velocity" | "pattern">("threshold");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [enabled, setEnabled] = useState(true);
  const [conditions, setConditions] = useState("{}");
  const [conditionsGuideOpen, setConditionsGuideOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MonitoringRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<MonitoringRule | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ items: MonitoringRule[]; total: number }>(
        "/monitoring-rules?limit=100&offset=0"
      );
      setRules(res.items ?? []);
    } catch {
      toast.error("Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const resetForm = () => {
    setName("");
    setType("threshold");
    setSeverity("medium");
    setEnabled(true);
    setConditions("{}");
    setEditingRule(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const handleOpenEdit = (rule: MonitoringRule) => {
    setName(rule.name);
    setType(rule.ruleType as "threshold" | "velocity" | "pattern");
    setSeverity(rule.severity as "low" | "medium" | "high" | "critical");
    setEnabled(rule.enabled);
    setConditions(
      typeof rule.conditions === "object" && rule.conditions !== null
        ? JSON.stringify(rule.conditions, null, 2)
        : "{}"
    );
    setEditingRule(rule);
    setCreateOpen(true);
  };

  const handleSaveRule = async () => {
    if (!name.trim()) {
      toast.error("Please enter a rule name");
      return;
    }
    let parsedConditions: Record<string, unknown> = {};
    try {
      parsedConditions = JSON.parse(conditions || "{}");
    } catch {
      toast.error("Conditions must be valid JSON");
      return;
    }
    try {
      if (editingRule) {
        await apiRequest(`/monitoring-rules/${editingRule.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            description: null,
            ruleType: type,
            conditions: parsedConditions,
            severity,
            enabled,
          }),
        });
        toast.success(`Rule "${name.trim()}" updated`);
      } else {
        await apiRequest<MonitoringRule>("/monitoring-rules", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: null,
            ruleType: type,
            conditions: parsedConditions,
            severity,
            enabled,
          }),
        });
        toast.success(`Rule "${name.trim()}" created`);
      }
      setCreateOpen(false);
      resetForm();
      fetchRules();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save rule");
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRule) return;
    try {
      await apiRequest(`/monitoring-rules/${deleteRule.id}`, {
        method: "DELETE",
      });
      setRules((prev) => prev.filter((r) => r.id !== deleteRule.id));
      setDeleteRule(null);
      toast.success(`Rule "${deleteRule.name}" deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete rule");
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) resetForm();
    setCreateOpen(open);
  };

  const columns = [
    { key: "name" as const, label: "Rule", sortable: true, render: (r: MonitoringRule) => <span className="font-medium">{r.name}</span> },
    { key: "ruleType" as const, label: "Type", sortable: true, render: (r: MonitoringRule) => <Badge variant="outline">{r.ruleType}</Badge> },
    { key: "severity" as const, label: "Severity", sortable: true, render: (r: MonitoringRule) => <Badge variant={getSeverityVariant(r.severity)}>{r.severity}</Badge> },
    { key: "enabled" as const, label: "Enabled", sortable: true, render: (r: MonitoringRule) => (r.enabled ? "Yes" : "No") },
    { key: "actions" as const, label: "", sortable: false, render: (r: MonitoringRule) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenEdit(r); }} aria-label="Edit rule">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteRule(r); }} aria-label="Delete rule">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Monitoring Rules</h1>
        <p className="text-muted-foreground">Transaction monitoring and alert rules</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Configure rules that trigger alerts</CardDescription>
          </div>
          <Button onClick={handleOpenCreate}>Create Rule</Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rules}
            sortKey="name"
            sortOrder="asc"
            onSort={() => {}}
            page={1}
            perPage={25}
            total={rules.length}
            onPageChange={() => {}}
            onPerPageChange={() => {}}
            loading={loading}
            emptyMessage="No monitoring rules"
            emptyAction={<Button variant="outline" onClick={handleOpenCreate}>Create first rule</Button>}
          />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit monitoring rule" : "Create monitoring rule"}</DialogTitle>
            <DialogDescription>
              Define a rule that triggers alerts when transaction activity matches the conditions you set.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div>
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g. PKR 2M Threshold"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="rule-type">Type</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Rule type help" className="inline-flex text-muted-foreground hover:text-foreground">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm">
                    <ul className="space-y-2 text-xs">
                      <li><strong>Threshold</strong> — {TYPE_HELP.threshold.description}</li>
                      <li><strong>Velocity</strong> — {TYPE_HELP.velocity.description}</li>
                      <li><strong>Pattern</strong> — {TYPE_HELP.pattern.description}</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <select
                id="rule-type"
                value={type}
                onChange={(e) => setType(e.target.value as "threshold" | "velocity" | "pattern")}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="threshold">Threshold</option>
                <option value="velocity">Velocity</option>
                <option value="pattern">Pattern</option>
              </select>
            </div>
            <div>
              <Label htmlFor="rule-severity">Severity</Label>
              <select
                id="rule-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as "low" | "medium" | "high" | "critical")}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="low">Low — Informational</option>
                <option value="medium">Medium — Review recommended</option>
                <option value="high">High — Prioritised review</option>
                <option value="critical">Critical — Immediate escalation</option>
              </select>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="rule-conditions">Conditions (JSON)</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setConditionsGuideOpen(true)}
                  >
                    Conditions guide
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setConditions(TYPE_HELP[type].example)}
                  >
                    Use example
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                JSON object defining when to trigger. See the guide for field reference and templates.
              </p>
              <textarea
                id="rule-conditions"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder={TYPE_HELP[type].example}
                rows={4}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span>Enabled</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule}>
              {editingRule ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conditionsGuideOpen} onOpenChange={setConditionsGuideOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Conditions (JSON) — Field reference & templates</DialogTitle>
            <DialogDescription>
              Use valid JSON. Amounts in smallest unit (e.g. paisa for PKR). Click a template to apply it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {(Object.keys(CONDITIONS_GUIDE) as Array<keyof typeof CONDITIONS_GUIDE>).map((ruleType) => (
              <div key={ruleType}>
                <h4 className="mb-2 font-medium capitalize text-sm">{ruleType}</h4>
                <div className="mb-2 rounded border bg-muted/30 p-3 text-xs">
                  <p className="mb-2 font-medium text-muted-foreground">Fields</p>
                  <dl className="space-y-1.5">
                    {CONDITIONS_GUIDE[ruleType].fields.map((f) => (
                      <div key={f.name} className="flex gap-2">
                        <dt className="font-mono text-foreground">{f.name}</dt>
                        <dd className="text-muted-foreground">— {f.desc}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Templates</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONDITIONS_GUIDE[ruleType].templates.map((t) => (
                    <Button
                      key={t.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setConditions(t.json);
                        setType(ruleType);
                        setConditionsGuideOpen(false);
                      }}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRule} onOpenChange={(open) => !open && setDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRule && `This will permanently remove "${deleteRule.name}". This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
