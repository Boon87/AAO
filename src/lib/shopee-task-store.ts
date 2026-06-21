// In-memory task queue for Chrome extension relay
// Must use global so all Next.js route module instances share the same Map
interface Task {
  id: string;
  keyword: string;
  resolve: (data: unknown) => void;
  reject: (e: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

type GlobalWithStore = typeof globalThis & { __shopeeTaskStore?: Map<string, Task> };
const g = global as GlobalWithStore;
if (!g.__shopeeTaskStore) g.__shopeeTaskStore = new Map();
const tasks = g.__shopeeTaskStore;

export function createShopeeTask(keyword: string, timeoutMs = 20000): Promise<unknown> {
  const id = `shopee-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      tasks.delete(id);
      reject(new Error("AAO Shopee 扩展未响应，请确保已安装并开启扩展"));
    }, timeoutMs);

    tasks.set(id, { id, keyword, resolve, reject, timeout });
  });
}

// Called by /api/shopee-task — returns next pending task (FIFO)
export function getNextPendingTask(): { id: string; keyword: string } | null {
  for (const [, task] of tasks) {
    return { id: task.id, keyword: task.keyword };
  }
  return null;
}

// Called by /api/shopee-relay when extension sends back results
export function resolveTask(taskId: string, data: unknown): boolean {
  const task = tasks.get(taskId);
  if (!task) return false;
  clearTimeout(task.timeout);
  tasks.delete(taskId);
  task.resolve(data);
  return true;
}

export function rejectTask(taskId: string, message: string): boolean {
  const task = tasks.get(taskId);
  if (!task) return false;
  clearTimeout(task.timeout);
  tasks.delete(taskId);
  task.reject(new Error(message));
  return true;
}
