"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { beginMfaSetup, confirmMfaSetup, disableMfa } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

export default function AdminMfaSetupPage() {
  const { user, accessToken, refreshUser } = useAuth();
  const router = useRouter();

  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!user || !accessToken) return null;

  async function handleBeginSetup() {
    setError(null);
    setIsLoading(true);
    try {
      const data = await beginMfaSetup(accessToken!);
      setSetupData(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start MFA setup.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await confirmMfaSetup(accessToken!, code);
      await refreshUser();
      router.push("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code didn't match. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisable() {
    if (!/^\d{6}$/.test(disableCode)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await disableMfa(accessToken!, disableCode);
      await refreshUser();
      setShowDisable(false);
      setDisableCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code didn't match. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copySecret() {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable — the secret is still visible on screen.
    }
  }

  if (user.mfaEnabled) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Security</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="success">MFA enabled</Badge>
            <p className="text-sm text-muted">Your account requires a code from your authenticator app to log in.</p>
          </div>
        </div>

        {!showDisable ? (
          <Button variant="outline" className="w-fit px-4 py-2 text-sm" onClick={() => setShowDisable(true)}>
            Disable MFA
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-danger/5 p-6">
            <p className="text-sm text-foreground">
              Disabling MFA removes this extra layer of protection on an account that can move real money.
              Enter your current code to confirm.
            </p>
            <Input
              label="Authentication code"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex gap-2">
              <Button variant="primary" isLoading={isLoading} className="px-4 py-2 text-sm" onClick={() => void handleDisable()}>
                Confirm disable
              </Button>
              <Button
                variant="outline"
                className="px-4 py-2 text-sm"
                onClick={() => {
                  setShowDisable(false);
                  setDisableCode("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Set up multi-factor authentication</h1>
        <p className="mt-2 text-sm text-muted">
          Required for every admin account — disbursement and matching actions move real money, and MFA is a
          compensating control against a stolen password or session alone being enough to reach them.
        </p>
      </div>

      {!setupData ? (
        <Button variant="primary" className="w-fit px-5 py-3" isLoading={isLoading} onClick={() => void handleBeginSetup()}>
          Begin setup
        </Button>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-background p-6">
            <p className="text-sm font-semibold text-foreground">1. Add this account to your authenticator app</p>
            <p className="mt-1 text-sm text-muted">
              Use Google Authenticator, 1Password, Authy, or similar. If your app can&apos;t scan a QR code, enter
              this key manually:
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg bg-surface px-3 py-2 text-sm text-foreground">
                {setupData.secret}
              </code>
              <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => void copySecret()}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6">
            <p className="text-sm font-semibold text-foreground">2. Enter the 6-digit code it generates</p>
            <div className="mt-3 flex flex-col gap-3">
              <Input
                label="Authentication code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button variant="primary" isLoading={isLoading} className="w-fit px-5 py-2.5" onClick={() => void handleConfirm()}>
                Verify and enable
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
