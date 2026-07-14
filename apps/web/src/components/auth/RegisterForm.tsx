"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { requestOtp, registerUser, verifyOtp } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Step = "details" | "otp";

const RESEND_COOLDOWN_SECONDS = 60;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();

  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  // Prefilled from a referral link (?ref=CODE), read once at construction time.
  const [referralCode, setReferralCode] = useState(() => (searchParams.get("ref") ?? "").toUpperCase());
  const [otpCode, setOtpCode] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function validateDetails(): boolean {
    const errors: Record<string, string> = {};
    if (fullName.trim().length < 2) errors.fullName = "Enter your full name.";
    if (phone.trim().length < 7) errors.phone = "Enter a valid phone number.";
    if (!/^\d{4}$/.test(pin)) errors.pin = "PIN must be exactly 4 digits.";
    if (confirmPin !== pin) errors.confirmPin = "PINs don't match.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSendCode(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validateDetails()) return;

    setIsSubmitting(true);
    try {
      await requestOtp(phone, "REGISTER");
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't send a code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setFormError(null);
    try {
      await requestOtp(phone, "REGISTER");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't resend the code.");
    }
  }

  async function handleVerifyAndRegister(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!/^\d{6}$/.test(otpCode)) {
      setFieldErrors({ otpCode: "Enter the 6-digit code." });
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyOtp(phone, "REGISTER", otpCode);
      const { user, accessToken } = await registerUser({
        phone,
        fullName: fullName.trim(),
        pin,
        referralCode: referralCode.trim() || undefined,
      });
      setSession(user, accessToken);
      router.push("/dashboard");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't verify your code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleVerifyAndRegister} noValidate className="flex flex-col gap-5">
        <p className="text-sm text-muted">
          We sent a 6-digit code to <span className="font-medium text-foreground">{phone}</span>.
        </p>
        <Input
          label="Verification code"
          name="otpCode"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          value={otpCode}
          onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          error={fieldErrors.otpCode}
        />
        {formError && (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            {formError}
          </div>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? "Verifying…" : "Verify & create account"}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setStep("details")}
            className="font-medium text-muted underline underline-offset-4 hover:text-foreground"
          >
            Change phone number
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="font-medium text-primary underline underline-offset-4 hover:text-primary-hover disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} noValidate className="flex flex-col gap-5">
      <Input
        label="Full name"
        name="fullName"
        autoComplete="name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        placeholder="Jane Doe"
        error={fieldErrors.fullName}
      />
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
        autoComplete="new-password"
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
        placeholder="••••"
        error={fieldErrors.pin}
      />
      <Input
        label="Confirm PIN"
        name="confirmPin"
        type="password"
        inputMode="numeric"
        maxLength={4}
        autoComplete="new-password"
        value={confirmPin}
        onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))}
        placeholder="••••"
        error={fieldErrors.confirmPin}
      />
      <Input
        label="Referral code (optional)"
        name="referralCode"
        value={referralCode}
        onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
        placeholder="e.g. AB12CD34"
      />
      {formError && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {formError}
        </div>
      )}
      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? "Sending code…" : "Send verification code"}
      </Button>
    </form>
  );
}
