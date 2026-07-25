export type ApiErrorBody = {
  success?: boolean;
  msg?: string;
  message?: string;
  error?: string;
  field?: 'email' | 'phone' | 'name' | string;
};

export function messageFromApiBody(body: ApiErrorBody | null | undefined, fallback: string): string {
  if (!body) return fallback;
  return body.msg?.trim() || body.message?.trim() || body.error?.trim() || fallback;
}

export async function readJsonResponse<T = ApiErrorBody>(res: Response): Promise<T & ApiErrorBody> {
  const text = await res.text();
  if (!text.trim()) {
    return {} as T & ApiErrorBody;
  }
  try {
    return JSON.parse(text) as T & ApiErrorBody;
  } catch {
    throw new Error(`Invalid server response (${res.status})`);
  }
}
