"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

export function PasswordResetButton({
  className,
}: {
  className: string;
}) {
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function requestReset() {
    if (isSending) return;

    try {
      setIsSending(true);
      setMessage("");
      setIsError(false);
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setIsError(true);
        setMessage(data.error ?? "Unable to send the reset email.");
        return;
      }

      setMessage(
        data.message ?? "Check your email for a secure password reset link.",
      );
    } catch (error) {
      console.error("Password reset request failed:", error);
      setIsError(true);
      setMessage("Unable to send the reset email. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void requestReset()}
        disabled={isSending}
        className={className}
      >
        <Lock size={18} aria-hidden="true" />
        {isSending ? "Sending reset email..." : "Change Password"}
      </button>
      {message && (
        <p
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </p>
      )}
    </>
  );
}
