"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { login, mfaLoginVerify } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const { setSession } = useAuth();

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCredentialsSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: Record<string, string> = {};
    if (phone.trim().length < 7) errors.phone = "Enter a valid phone number.";
    if (!/^\d{4}$/.test(pin)) errors.pin = "PIN must be exactly 4 digits.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const result = await login({ phone, pin });
      if (result.mfaRequired) {
        setMfaPendingToken(result.mfaPendingToken);
      } else {
        setSession(result.user, result.accessToken);
        router.push("/dashboard");
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't log you in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!mfaPendingToken) return;
    if (!/^\d{6}$/.test(mfaCode)) {
      setFieldErrors({ mfaCode: "Enter the 6-digit code from your authenticator app." });
      return;
    }

    setIsSubmitting(true);
    try {
      const { user, accessToken } = await mfaLoginVerify(mfaPendingToken, mfaCode);
      setSession(user, accessToken);
      router.push("/dashboard");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't verify that code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (mfaPendingToken) {
    return (
      <form onSubmit={handleMfaSubmit} noValidate className="flex flex-col gap-5">
        <p className="text-sm text-muted">
          Enter the 6-digit code from your authenticator app to finish logging in.
        </p>
        <Input
          label="Authentication code"
          name="mfaCode"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          value={mfaCode}
          onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          error={fieldErrors.mfaCode}
        />
        {formError && (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            {formError}
          </div>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? "Verifying…" : "Verify and log in"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setMfaPendingToken(null);
            setMfaCode("");
            setFormError(null);
          }}
          className="text-center text-sm font-medium text-muted hover:text-foreground"
        >
          Back
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentialsSubmit} noValidate className="flex flex-col gap-5">
      <Input
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="080..."
        error={fieldErrors.phone}
      />
      <Input
        label="4-digit PIN"
        name="pin"
        type="password"
        inputMode="numeric"
        maxLength={4}
        autoComplete="current-password"
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
        placeholder="••••"
        error={fieldErrors.pin}
      />
      {formError && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {formError}
        </div>
      )}
      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>
      <p className="text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary underline underline-offset-4 hover:text-primary-hover">
          Create one
        </Link>
      </p>
    </form>
  );
}
