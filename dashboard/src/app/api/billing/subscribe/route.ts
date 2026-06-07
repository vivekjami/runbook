import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  // Guard: Razorpay keys must be configured
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_PLAN_ID;

  if (!keyId || !keySecret || !planId) {
    return NextResponse.json(
      { error: "Billing is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_PLAN_ID." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Lazy-init Razorpay inside handler to avoid build-time crash when env vars are empty
    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12,
      notes: {
        user_id: user.id,
        email: user.email ?? "",
      },
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      razorpay_key: keyId,
      user_email: user.email,
    });
  } catch (err) {
    console.error("Razorpay subscription creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}
