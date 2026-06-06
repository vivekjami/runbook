import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  // Verify webhook signature
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.event === "subscription.activated") {
    const notes = event.payload.subscription.entity.notes ?? {};
    const userId = notes.user_id;
    const subscriptionId = event.payload.subscription.entity.id;

    if (userId) {
      const supabase = await createClient();
      await supabase
        .from("workspace_settings")
        .update({
          plan: "pro",
          razorpay_sub_id: subscriptionId,
        })
        .eq("user_id", userId);
    }
  }

  if (event.event === "subscription.cancelled") {
    const notes = event.payload.subscription.entity.notes ?? {};
    const userId = notes.user_id;

    if (userId) {
      const supabase = await createClient();
      await supabase
        .from("workspace_settings")
        .update({ plan: "trial" })
        .eq("user_id", userId);
    }
  }

  return NextResponse.json({ received: true });
}
