"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const { setSession } = useAuth();

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: Record<string, string> = {};
    if (phone.trim().length < 7) errors.phone = "Enter a valid phone number.";
    if (!/^\d{4}$/.test(pin)) errors.pin = "PIN must be exactly 4 digits.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const { user, accessToken } = await login({ phone, pin });
      setSession(user, accessToken);
      router.push("/dashboard");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't log you in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
