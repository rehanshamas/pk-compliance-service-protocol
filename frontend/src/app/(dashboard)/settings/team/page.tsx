"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { apiRequest } from "@/lib/api";

interface TeamUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export default function SettingsTeamPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [deactivateUser, setDeactivateUser] = useState<{ id: string; name: string } | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("analyst");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const res = await apiRequest<TeamUser[]>("/tenants/me/users");
      setUsers(Array.isArray(res) ? res : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName || !invitePassword) {
      setInviteError("All fields are required");
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      await apiRequest("/tenants/me/users", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteName,
          role: inviteRole,
          password: invitePassword,
        }),
      });
      setInviteSuccess(`User ${inviteEmail} created`);
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      setInviteRole("analyst");
      setTimeout(() => setInviteSuccess(null), 3000);
      await loadUsers();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to create user");
    }
    setInviting(false);
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading team...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-muted-foreground">Manage users and roles for this tenant</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>{users.length} users</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.length === 0 && (
              <p className="text-sm text-muted-foreground">No team members found. Invite one below.</p>
            )}
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{u.fullName}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{u.role}</Badge>
                  <span className="text-sm text-muted-foreground">
                    Last: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeactivateUser({ id: u.id, name: u.fullName })}
                  >
                    Deactivate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Invite User</CardTitle>
          <CardDescription>Add a new team member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {inviteSuccess && (
            <p className="text-sm font-medium text-emerald-600">{inviteSuccess}</p>
          )}
          {inviteError && (
            <p className="text-sm font-medium text-destructive">{inviteError}</p>
          )}
          <div>
            <Label>Full Name</Label>
            <Input
              type="text"
              placeholder="Ahmed Hassan"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="user@vasp.pk"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Initial password"
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
            />
          </div>
          <div>
            <Label>Role</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="analyst">Analyst</option>
              <option value="compliance_officer">Compliance Officer</option>
              <option value="mlro">MLRO</option>
            </select>
          </div>
          <Button onClick={handleInvite} disabled={inviting}>
            {inviting ? "Creating..." : "Create User"}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={!!deactivateUser} onOpenChange={(open) => !open && setDeactivateUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivating &quot;{deactivateUser?.name}&quot; will revoke their access. They will not be able to log in. You can reactivate them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setDeactivateUser(null)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
