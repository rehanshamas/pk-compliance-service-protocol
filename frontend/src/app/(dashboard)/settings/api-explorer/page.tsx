"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Play,
  Search,
  Globe,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface OpenAPIParameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: any;
}

interface OpenAPIRequestBody {
  content?: Record<string, { schema?: any }>;
  required?: boolean;
  description?: string;
}

interface OpenAPIResponse {
  description?: string;
  content?: Record<string, { schema?: any }>;
}

interface OpenAPIEndpoint {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  operationId?: string;
}

interface EndpointGroup {
  tag: string;
  endpoints: OpenAPIEndpoint[];
}

const METHOD_COLORS: Record<string, string> = {
  get: "bg-green-600/20 text-green-400 border-green-600/30",
  post: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  put: "bg-amber-600/20 text-amber-400 border-amber-600/30",
  patch: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
  delete: "bg-red-600/20 text-red-400 border-red-600/30",
};

function MethodBadge({ method }: { method: string }) {
  const m = method.toLowerCase();
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold uppercase border min-w-[56px] ${METHOD_COLORS[m] || "bg-muted text-muted-foreground"}`}
    >
      {method}
    </span>
  );
}

function SchemaViewer({ schema, definitions, depth = 0 }: { schema: any; definitions?: any; depth?: number }) {
  if (!schema) return <span className="text-muted-foreground text-xs">No schema</span>;

  // Resolve $ref
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/components/schemas/", "").replace("#/definitions/", "");
    const resolved = definitions?.[refName];
    if (resolved) {
      return (
        <div className="pl-2 border-l border-border/50">
          <span className="text-xs text-muted-foreground font-mono">{refName}</span>
          {depth < 3 && <SchemaViewer schema={resolved} definitions={definitions} depth={depth + 1} />}
        </div>
      );
    }
    return <span className="text-xs font-mono text-muted-foreground">{refName}</span>;
  }

  if (schema.type === "array" && schema.items) {
    return (
      <div className="text-xs">
        <span className="text-muted-foreground">Array of:</span>
        <SchemaViewer schema={schema.items} definitions={definitions} depth={depth + 1} />
      </div>
    );
  }

  if (schema.type === "object" || schema.properties) {
    const props = schema.properties || {};
    const required = schema.required || [];
    return (
      <div className="text-xs space-y-1 pl-2 border-l border-border/50">
        {Object.entries(props).map(([key, val]: [string, any]) => (
          <div key={key} className="flex items-start gap-2">
            <span className="font-mono text-foreground">{key}</span>
            {required.includes(key) && <span className="text-red-400 text-[10px]">*</span>}
            <span className="text-muted-foreground">
              {val.type || (val.$ref ? val.$ref.split("/").pop() : "object")}
            </span>
            {val.description && (
              <span className="text-muted-foreground/70"> - {val.description}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf || schema.oneOf;
    return (
      <div className="text-xs text-muted-foreground">
        {variants.map((v: any, i: number) => (
          <span key={i}>
            {i > 0 && " | "}
            {v.type || (v.$ref ? v.$ref.split("/").pop() : "any")}
          </span>
        ))}
      </div>
    );
  }

  return <span className="text-xs text-muted-foreground">{schema.type || "any"}</span>;
}

function EndpointRow({
  endpoint,
  definitions,
  onTryIt,
}: {
  endpoint: OpenAPIEndpoint;
  definitions?: any;
  onTryIt: (ep: OpenAPIEndpoint) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const bodySchema = endpoint.requestBody?.content?.["application/json"]?.schema;
  const responseSchema =
    endpoint.responses?.["200"]?.content?.["application/json"]?.schema ||
    endpoint.responses?.["201"]?.content?.["application/json"]?.schema;

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <MethodBadge method={endpoint.method} />
        <span className="font-mono text-sm flex-1 truncate">{endpoint.path}</span>
        {endpoint.summary && (
          <span className="text-sm text-muted-foreground truncate max-w-[300px] hidden lg:inline">
            {endpoint.summary}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t bg-muted/10 p-4 space-y-4">
          {endpoint.summary && (
            <p className="text-sm font-medium">{endpoint.summary}</p>
          )}
          {endpoint.description && (
            <p className="text-sm text-muted-foreground">{endpoint.description}</p>
          )}

          {/* Parameters */}
          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Parameters
              </h4>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20">
                      <th className="text-left p-2 pl-3 font-medium text-xs">Name</th>
                      <th className="text-left p-2 font-medium text-xs">In</th>
                      <th className="text-left p-2 font-medium text-xs">Type</th>
                      <th className="text-left p-2 pr-3 font-medium text-xs">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.parameters.map((p, i) => (
                      <tr key={i} className="border-t border-muted/50">
                        <td className="p-2 pl-3 font-mono text-xs">{p.name}</td>
                        <td className="p-2 text-xs text-muted-foreground">{p.in}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {p.schema?.type || "string"}
                        </td>
                        <td className="p-2 pr-3 text-xs">
                          {p.required ? (
                            <span className="text-red-400">Yes</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request Body */}
          {bodySchema && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Request Body
              </h4>
              <div className="rounded-md border p-3 bg-muted/5">
                <SchemaViewer schema={bodySchema} definitions={definitions} />
              </div>
            </div>
          )}

          {/* Response */}
          {responseSchema && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Response (200)
              </h4>
              <div className="rounded-md border p-3 bg-muted/5">
                <SchemaViewer schema={responseSchema} definitions={definitions} />
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={() => onTryIt(endpoint)}>
              <Play className="mr-2 h-3 w-3" />
              Try It
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiExplorerPage() {
  const [spec, setSpec] = useState<any>(null);
  const [groups, setGroups] = useState<EndpointGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Try It dialog state
  const [tryItOpen, setTryItOpen] = useState(false);
  const [tryItEndpoint, setTryItEndpoint] = useState<OpenAPIEndpoint | null>(null);
  const [tryItParams, setTryItParams] = useState<Record<string, string>>({});
  const [tryItBody, setTryItBody] = useState("");
  const [tryItResponse, setTryItResponse] = useState<string | null>(null);
  const [tryItStatus, setTryItStatus] = useState<number | null>(null);
  const [tryItLoading, setTryItLoading] = useState(false);

  const fetchSpec = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("cip_access_token")
          : null;
      const res = await fetch(`${API_BASE}/api/v1/developer/openapi.json`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status}`);
      const data = await res.json();
      setSpec(data);
      parseSpec(data);
    } catch (err: any) {
      setError(err.message || "Failed to load API specification");
    } finally {
      setLoading(false);
    }
  }, []);

  const parseSpec = (data: any) => {
    const paths = data.paths || {};
    const groupMap: Record<string, OpenAPIEndpoint[]> = {};

    for (const [path, methods] of Object.entries(paths) as [string, any][]) {
      for (const [method, detail] of Object.entries(methods) as [string, any][]) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          const tags = detail.tags || [guessTag(path)];
          const ep: OpenAPIEndpoint = {
            method: method.toUpperCase(),
            path,
            summary: detail.summary,
            description: detail.description,
            tags,
            parameters: detail.parameters,
            requestBody: detail.requestBody,
            responses: detail.responses,
            operationId: detail.operationId,
          };
          const tag = tags[0] || "Other";
          if (!groupMap[tag]) groupMap[tag] = [];
          groupMap[tag].push(ep);
        }
      }
    }

    const sorted = Object.entries(groupMap)
      .map(([tag, endpoints]) => ({ tag, endpoints }))
      .sort((a, b) => a.tag.localeCompare(b.tag));

    setGroups(sorted);
    // Expand first group by default
    if (sorted.length > 0) {
      setExpandedGroups(new Set([sorted[0].tag]));
    }
  };

  const guessTag = (path: string): string => {
    const parts = path.replace("/api/v1/", "").split("/");
    return parts[0]
      ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
      : "Other";
  };

  useEffect(() => {
    fetchSpec();
  }, [fetchSpec]);

  const toggleGroup = (tag: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleTryIt = (ep: OpenAPIEndpoint) => {
    setTryItEndpoint(ep);
    const params: Record<string, string> = {};
    if (ep.parameters) {
      for (const p of ep.parameters) {
        params[p.name] = "";
      }
    }
    setTryItParams(params);

    // Pre-populate body with schema skeleton
    const bodySchema =
      ep.requestBody?.content?.["application/json"]?.schema;
    if (bodySchema) {
      const skeleton = buildSkeleton(bodySchema, spec?.components?.schemas || {});
      setTryItBody(JSON.stringify(skeleton, null, 2));
    } else {
      setTryItBody("");
    }

    setTryItResponse(null);
    setTryItStatus(null);
    setTryItOpen(true);
  };

  const buildSkeleton = (schema: any, defs: any, depth = 0): any => {
    if (depth > 3) return {};
    if (schema.$ref) {
      const name = schema.$ref.replace("#/components/schemas/", "").replace("#/definitions/", "");
      return defs[name] ? buildSkeleton(defs[name], defs, depth + 1) : {};
    }
    if (schema.type === "object" || schema.properties) {
      const obj: any = {};
      for (const [k, v] of Object.entries(schema.properties || {}) as [string, any][]) {
        if (v.type === "string") obj[k] = "";
        else if (v.type === "number" || v.type === "integer") obj[k] = 0;
        else if (v.type === "boolean") obj[k] = false;
        else if (v.type === "array") obj[k] = [];
        else obj[k] = buildSkeleton(v, defs, depth + 1);
      }
      return obj;
    }
    if (schema.type === "array") return [];
    return null;
  };

  const executeTryIt = async () => {
    if (!tryItEndpoint) return;
    setTryItLoading(true);
    setTryItResponse(null);
    setTryItStatus(null);

    try {
      // Build URL with path params replaced and query params appended
      let url = `${API_BASE}${tryItEndpoint.path}`;
      const queryParams: string[] = [];

      for (const [key, val] of Object.entries(tryItParams)) {
        const paramDef = tryItEndpoint.parameters?.find((p) => p.name === key);
        if (!val) continue;
        if (paramDef?.in === "path") {
          url = url.replace(`{${key}}`, encodeURIComponent(val));
        } else if (paramDef?.in === "query") {
          queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
        }
      }

      if (queryParams.length > 0) {
        url += (url.includes("?") ? "&" : "?") + queryParams.join("&");
      }

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("cip_access_token")
          : null;

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const fetchOptions: RequestInit = {
        method: tryItEndpoint.method,
        headers,
      };

      if (tryItBody && ["POST", "PUT", "PATCH"].includes(tryItEndpoint.method)) {
        headers["Content-Type"] = "application/json";
        fetchOptions.body = tryItBody;
      }

      fetchOptions.headers = headers;
      const res = await fetch(url, fetchOptions);
      setTryItStatus(res.status);

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setTryItResponse(JSON.stringify(json, null, 2));
      } catch {
        setTryItResponse(text);
      }
    } catch (err: any) {
      setTryItResponse(`Error: ${err.message}`);
      setTryItStatus(0);
    } finally {
      setTryItLoading(false);
    }
  };

  // Filter groups based on search
  const filteredGroups = searchQuery
    ? groups
        .map((g) => ({
          ...g,
          endpoints: g.endpoints.filter(
            (ep) =>
              ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (ep.summary || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
              ep.method.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((g) => g.endpoints.length > 0)
    : groups;

  const totalEndpoints = groups.reduce((acc, g) => acc + g.endpoints.length, 0);
  const definitions = spec?.components?.schemas || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">API Explorer</h1>
          <p className="text-muted-foreground">
            Browse and test the CIP platform API
            {spec?.info?.version && (
              <span className="ml-2 text-xs">v{spec.info.version}</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSpec} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSpec}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search and stats */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{totalEndpoints} endpoints</span>
              <span>{groups.length} groups</span>
            </div>
          </div>

          {/* Endpoint Groups */}
          <div className="space-y-3">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.tag);
              return (
                <Card key={group.tag}>
                  <button
                    onClick={() => toggleGroup(group.tag)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h2 className="text-base font-semibold">{group.tag}</h2>
                      <Badge variant="secondary" className="text-xs">
                        {group.endpoints.length}
                      </Badge>
                    </div>
                  </button>
                  {isExpanded && (
                    <CardContent className="pt-0 space-y-2">
                      {group.endpoints.map((ep, i) => (
                        <EndpointRow
                          key={`${ep.method}-${ep.path}-${i}`}
                          endpoint={ep}
                          definitions={definitions}
                          onTryIt={handleTryIt}
                        />
                      ))}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {filteredGroups.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No endpoints match your search.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Try It Dialog */}
      <Dialog open={tryItOpen} onOpenChange={setTryItOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {tryItEndpoint && <MethodBadge method={tryItEndpoint.method} />}
              <span className="font-mono text-sm truncate">
                {tryItEndpoint?.path}
              </span>
            </DialogTitle>
            <DialogDescription>
              {tryItEndpoint?.summary || "Execute this API endpoint"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Parameters */}
            {tryItEndpoint?.parameters && tryItEndpoint.parameters.length > 0 && (
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Parameters
                </Label>
                {tryItEndpoint.parameters.map((p) => (
                  <div key={p.name}>
                    <Label className="text-xs">
                      {p.name}
                      {p.required && <span className="text-red-400 ml-1">*</span>}
                      <span className="text-muted-foreground ml-2">({p.in})</span>
                    </Label>
                    <Input
                      value={tryItParams[p.name] || ""}
                      onChange={(e) =>
                        setTryItParams((prev) => ({
                          ...prev,
                          [p.name]: e.target.value,
                        }))
                      }
                      placeholder={p.description || p.name}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Request Body */}
            {tryItEndpoint &&
              ["POST", "PUT", "PATCH"].includes(tryItEndpoint.method) && (
                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">
                    Request Body (JSON)
                  </Label>
                  <textarea
                    value={tryItBody}
                    onChange={(e) => setTryItBody(e.target.value)}
                    rows={8}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="{}"
                  />
                </div>
              )}

            <Button
              onClick={executeTryIt}
              disabled={tryItLoading}
              className="w-full"
            >
              {tryItLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Send Request
            </Button>

            {/* Response */}
            {tryItResponse !== null && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">
                    Response
                  </Label>
                  {tryItStatus !== null && (
                    <Badge
                      variant={
                        tryItStatus >= 200 && tryItStatus < 300
                          ? "default"
                          : "destructive"
                      }
                    >
                      {tryItStatus}
                    </Badge>
                  )}
                </div>
                <pre className="rounded-md border bg-muted/20 p-3 text-xs font-mono overflow-auto max-h-[300px] whitespace-pre-wrap break-words">
                  {tryItResponse}
                </pre>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTryItOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
