"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  disableSync,
  enableSync,
  getSyncCodeFormatted,
  joinSync,
  syncNow,
} from "@/lib/sync";
import { useUi } from "@/lib/ui-store";

function formatLastSync(iso: string | null): string {
  if (!iso) return "Not synced yet";
  return `Synced at ${new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

export default function SyncDialog() {
  const open = useUi((s) => s.syncDialogOpen);
  const setOpen = useUi((s) => s.setSyncDialogOpen);
  const status = useUi((s) => s.syncStatus);
  const syncError = useUi((s) => s.syncError);
  const lastSyncAt = useUi((s) => s.lastSyncAt);

  const [joinInput, setJoinInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codeVisible, setCodeVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const enabled = status !== "off";
  const code = enabled ? getSyncCodeFormatted() : null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setJoinInput("");
      setFormError(null);
      setCodeVisible(false);
      setCopied(false);
      setConfirmDelete(false);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setFormError(null);
    try {
      await fn();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something broke");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setFormError("Couldn't copy automatically — select the code manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync across devices</DialogTitle>
          <DialogDescription>
            End-to-end encrypted. The sync code is the only key — it never
            leaves your devices, and the server only stores ciphertext.
          </DialogDescription>
        </DialogHeader>

        {!enabled ? (
          <div className="flex flex-col gap-5">
            <div>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await enableSync();
                    setCodeVisible(true);
                  })
                }
              >
                Create a sync code
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Generates a code for this device&apos;s data. Enter it on
                your other devices to link them.
              </p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <label htmlFor="sync-join" className="text-sm">
                Already have a code?
              </label>
              <div className="flex gap-2">
                <Input
                  id="sync-join"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  disabled={busy || !joinInput.trim()}
                  onClick={() =>
                    run(async () => {
                      await joinSync(joinInput);
                      handleOpenChange(false);
                    })
                  }
                >
                  Link
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {status === "syncing"
                ? "Syncing…"
                : status === "error"
                  ? (syncError ?? "Sync failed")
                  : formatLastSync(lastSyncAt)}
            </p>

            {codeVisible && code ? (
              <div className="flex flex-col gap-2">
                <code className="rounded-lg border border-border bg-muted/50 p-3 text-center font-mono text-xs tracking-wide break-all select-all">
                  {code}
                </code>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={copyCode}>
                    {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                    {copied ? "Copied" : "Copy code"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Treat it like a password — anyone with it can read your
                    synced data.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCodeVisible(true)}
                >
                  Show sync code
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={busy || status === "syncing"}
                onClick={() => run(() => syncNow())}
              >
                <RefreshCw aria-hidden />
                Sync now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await disableSync();
                    handleOpenChange(false);
                  })
                }
              >
                Unlink this device
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  void run(async () => {
                    await disableSync({ deleteRemote: true });
                    handleOpenChange(false);
                  });
                }}
              >
                {confirmDelete ? "Really delete server copy?" : "Delete server copy"}
              </Button>
            </div>
          </div>
        )}

        {formError && (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
