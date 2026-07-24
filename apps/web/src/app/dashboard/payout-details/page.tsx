"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { updatePayoutBankDetails } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PayoutIcon } from "@/components/dashboard/NavIcons";

const COMMON_BANKS = [
  "Access Bank",
  "GTBank",
  "Zenith Bank",
  "First Bank of Nigeria",
  "UBA",
  "Fidelity Bank",
  "Union Bank",
  "Stanbic IBTC",
  "Sterling Bank",
  "Wema Bank",
  "Kuda",
  "Opay",
  "PalmPay",
  "Moniepoint",
];

export default function PayoutDetailsPage() {
  const { user, accessToken, refreshUser } = useAuth();
  const [bankName, setBankName] = useState(user?.payoutBankDetails?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(user?.payoutBankDetails?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(user?.payoutBankDetails?.accountName ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user || !accessToken) return null;

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (bankName.trim().length < 2) errors.bankName = "Enter your bank's name.";
    if (!/^\d{10}$/.test(accountNumber)) errors.accountNumber = "Account number must be exactly 10 digits.";
    if (accountName.trim().length < 2) errors.accountName = "Enter the account holder's name.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await updatePayoutBankDetails(accessToken!, {
        bankName: bankName.trim(),
        accountNumber,
        accountName: accountName.trim(),
      });
      await refreshUser();
      setSuccess(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't save your details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PayoutIcon />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payout bank details</h1>
          <p className="mt-1 text-sm text-muted">
            This is the account we&apos;ll disburse your payout to. Double-check it — an incorrect
            account number can delay your payout.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 flex flex-col gap-5 rounded-2xl border border-border bg-background p-6 shadow-sm"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bankName" className="text-sm font-medium text-foreground">
            Bank name
          </label>
          <input
            id="bankName"
            name="bankName"
            list="bank-options"
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
            placeholder="e.g. GTBank"
            className={`rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              fieldErrors.bankName ? "border-danger" : "border-border"
            }`}
            aria-invalid={fieldErrors.bankName ? "true" : undefined}
            aria-describedby={fieldErrors.bankName ? "bankName-error" : undefined}
          />
          <datalist id="bank-options">
            {COMMON_BANKS.map((bank) => (
              <option key={bank} value={bank} />
            ))}
          </datalist>
          {fieldErrors.bankName && (
            <p id="bankName-error" className="text-sm text-danger">
              {fieldErrors.bankName}
            </p>
          )}
        </div>

        <Input
          label="Account number"
          name="accountNumber"
          inputMode="numeric"
          maxLength={10}
          value={accountNumber}
          onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
          placeholder="0123456789"
          error={fieldErrors.accountNumber}
        />

        <Input
          label="Account holder name"
          name="accountName"
          value={accountName}
          onChange={(event) => setAccountName(event.target.value)}
          placeholder="As it appears on your bank account"
          error={fieldErrors.accountName}
        />

        {formError && (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            {formError}
          </div>
        )}
        {success && (
          <div role="status" className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-success">
            Payout details saved.
          </div>
        )}

        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save payout details"}
        </Button>
      </form>
    </div>
  );
}
