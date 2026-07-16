"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth/client";

export interface UserRow {
  id: string;
  name: string;
  username: string | null;
  role: string | null;
}

const inviteSchema = z.object({
  name: z.string().min(1, "A display name is required"),
  username: z
    .string()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9_.-]+$/i, "Letters, numbers, dots, dashes and underscores only"),
  password: z.string().min(10, "At least 10 characters"),
});

type InviteValues = z.infer<typeof inviteSchema>;

export function UsersSettings({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: "", username: "", password: "" },
  });

  async function onInvite(values: InviteValues) {
    // Better Auth's admin plugin types roles as "user" | "admin"; "user" is
    // our read-only viewer (requireAdmin gates every mutation on "admin").
    const { error } = await authClient.admin.createUser({
      email: `${values.username.toLowerCase()}@farmstead.local`,
      password: values.password,
      name: values.name,
      role: "user",
      data: {
        username: values.username.toLowerCase(),
        displayUsername: values.username,
      },
    });
    if (error) {
      toast.error(error.message ?? "Could not create the account.");
      return;
    }
    toast.success(`Viewer account @${values.username.toLowerCase()} created.`);
    form.reset();
    setOpen(false);
    router.refresh();
  }

  async function removeUser(user: UserRow) {
    setRemovingId(user.id);
    const { error } = await authClient.admin.removeUser({ userId: user.id });
    setRemovingId(null);
    if (error) {
      toast.error(error.message ?? "Could not remove the account.");
      return;
    }
    toast.success(`Removed @${user.username ?? user.name}.`);
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Viewers can see everything but change nothing. There is no public
            sign-up — accounts exist only if you create them here.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="size-4" /> Invite viewer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Invite a viewer</DialogTitle>
              <DialogDescription>
                Share the username and password with them directly.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onInvite)} className="flex flex-col gap-4" noValidate>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Accountant" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input autoCapitalize="none" spellCheck={false} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="text" autoComplete="off" {...field} />
                      </FormControl>
                      <FormDescription>Visible so you can copy it once.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Create viewer
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell className="text-muted-foreground">@{u.username ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role === "admin" ? "Admin" : "Viewer"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.id !== currentUserId && u.role !== "admin" ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void removeUser(u)}
                      disabled={removingId === u.id}
                      aria-label={`Remove ${u.name}`}
                    >
                      {removingId === u.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
