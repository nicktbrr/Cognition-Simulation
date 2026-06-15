// Client-side helpers for Stripe checkout. The actual Stripe calls (and the
// secret key) live in the Flask backend at /api/checkout and
// /api/checkout/verify. Nothing secret is referenced here.

export interface VerifyResult {
  paid: boolean;
  amount: number;
  userId: string | null;
  // New credit balance after this payment (from user_emails.credits), or null
  // if the backend couldn't apply it.
  balance: number | null;
}

// Same backend selection the rest of the app uses (see simulation/page.tsx).
const backendBaseUrl = (): string => {
  const prod = process.env.NEXT_PUBLIC_DEV || "production";
  return prod === "development"
    ? "http://127.0.0.1:5000"
    : "https://cognition-backend-81313456654.us-west1.run.app";
};

/**
 * Ask the backend to create a Checkout Session for `amount` dollars, then send
 * the browser to Stripe's hosted checkout. Throws with a readable message on
 * failure; on success the browser navigates away.
 */
export const startCheckout = async (
  amount: number,
  opts?: { userId?: string; email?: string }
): Promise<void> => {
  const res = await fetch(`${backendBaseUrl()}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      userId: opts?.userId,
      email: opts?.email,
      // So the backend builds success/cancel URLs back to this frontend.
      origin: window.location.origin,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; message?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error || data.message || "Could not start checkout. Please try again.");
  }

  window.location.href = data.url;
};

/**
 * Verify a completed Checkout Session by id (from the success redirect). Returns
 * the trusted paid amount so the caller can credit the balance.
 */
export const verifyCheckout = async (sessionId: string): Promise<VerifyResult> => {
  const res = await fetch(
    `${backendBaseUrl()}/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`
  );

  const data = (await res.json().catch(() => ({}))) as Partial<VerifyResult> & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || data.message || "Could not verify payment.");
  }
  return {
    paid: Boolean(data.paid),
    amount: typeof data.amount === "number" ? data.amount : 0,
    userId: typeof data.userId === "string" ? data.userId : null,
    balance: typeof data.balance === "number" ? data.balance : null,
  };
};
