"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/modal";
import { useAuth } from "@/hooks/use-auth";
import { useTableStyle, tableStyles } from "@/hooks/use-table-style";
import { TableStyleSelector } from "@/components/table-style-selector";
import { apiError } from "@/lib/api";
import { userService } from "@/lib/services";
import type { User } from "@/lib/types";

function UserForm({ user, onClose }: { user: User | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(user?.username || "");
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(user?.is_admin ?? false);
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => user
      ? userService.update(user.id, {
          display_name: displayName, is_admin: isAdmin,
          ...(password ? { password } : {}),
        })
      : userService.create({ username: username.trim(), password, display_name: displayName, is_admin: isAdmin }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); onClose(); },
    onError: (e) => setError(apiError(e)),
  });

  const valid = user ? (!password || password.length >= 6) : username.trim().length >= 2 && password.length >= 6;

  return (
    <Modal open onClose={onClose} title={user ? `Editar usuario · ${user.username}` : "Nuevo usuario"} size="md" nested>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
        {!user && (
          <div className="space-y-1.5">
            <Label>Usuario *</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={2} autoFocus />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Nombre visible</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{user ? "Nueva contraseña (dejar vacía para mantener)" : "Contraseña *"}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required={!user} minLength={6} autoComplete="new-password" />
          <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres.</p>
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Administrador</Label>
          <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsuariosPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { tableStyle } = useTableStyle();
  const st = tableStyles[tableStyle];
  const [formUser, setFormUser] = useState<User | null | undefined>(undefined);
  const [delUser, setDelUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: userService.list });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => userService.update(id, { is_active }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e) => setError(apiError(e)),
  });
  const del = useMutation({
    mutationFn: (id: number) => userService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setDelUser(null); },
    onError: (e) => { setError(apiError(e)); setDelUser(null); },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando usuarios…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold">Usuarios</h1>
            <p className="text-sm text-muted-foreground">Cuentas de acceso. Solo administradores pueden gestionar usuarios.</p>
          </div>
          <div className="flex items-center gap-2">
            <TableStyleSelector />
            <Button size="sm" onClick={() => setFormUser(null)}>
              <Plus className="mr-2 h-4 w-4" />Nuevo usuario
            </Button>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="rounded-lg border bg-card">
          <Table className={st.tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Nombre visible</TableHead>
                <TableHead className="text-center">Rol</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => (
                <TableRow key={u.id} className={st.rowClass}>
                  <TableCell className={st.cellClass + " font-mono text-sm"}>
                    {u.username}{me?.id === u.id && <span className="ml-2 text-[10px] text-muted-foreground">(vos)</span>}
                  </TableCell>
                  <TableCell className={st.cellClass + " text-sm"}>{u.display_name || "—"}</TableCell>
                  <TableCell className={st.cellClass + " text-center"}>
                    <Badge variant={u.is_admin ? "default" : "secondary"}>
                      {u.is_admin ? "Admin" : "Usuario"}
                    </Badge>
                  </TableCell>
                  <TableCell className={st.cellClass + " text-center"}>
                    <Switch checked={u.is_active} disabled={me?.id === u.id}
                      onCheckedChange={(v) => toggleActive.mutate({ id: u.id, is_active: v })} aria-label="Activo" />
                  </TableCell>
                  <TableCell className={st.cellClass + " text-right"}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar" onClick={() => setFormUser(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      aria-label="Eliminar" disabled={me?.id === u.id} onClick={() => setDelUser(u)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {formUser !== undefined && <UserForm user={formUser} onClose={() => setFormUser(undefined)} />}
      <ConfirmDialog open={!!delUser} title="Eliminar usuario"
        message={delUser ? <>Se eliminará la cuenta <b>{delUser.username}</b>. Esta acción no se puede deshacer.</> : ""}
        confirmLabel="Eliminar" destructive
        onConfirm={() => delUser && del.mutate(delUser.id)} onCancel={() => setDelUser(null)} />
    </div>
  );
}