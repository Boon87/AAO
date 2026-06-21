import { NextResponse } from "next/server";
import { getNextPendingTask } from "@/lib/shopee-task-store";

// Chrome extension polls this endpoint every 1.5s for pending search tasks
export async function GET() {
  const task = getNextPendingTask();
  if (!task) {
    return NextResponse.json(null);
  }
  return NextResponse.json(task);
}
