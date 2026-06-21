import { NextRequest, NextResponse } from "next/server";
import { resolveTask, rejectTask } from "@/lib/shopee-task-store";

// Chrome extension POSTs Shopee results here
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { taskId, status, data } = body;

  if (!taskId) {
    return NextResponse.json({ error: "missing taskId" }, { status: 400 });
  }

  console.log("[Shopee Relay] status:", status, "error:", data?.error, "items:", data?.items?.length ?? "n/a", "is_login:", data?.is_login ?? data?.["2"]);

  if (status !== 200 || (data?.error && data.error !== 0)) {
    rejectTask(taskId, `Shopee 返回错误 ${data?.error ?? status}`);
    return NextResponse.json({ ok: false });
  }

  const resolved = resolveTask(taskId, data);
  return NextResponse.json({ ok: resolved });
}
