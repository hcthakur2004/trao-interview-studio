export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      body.error?.message || 'Request failed. Please try again.',
      response.status,
      body.error?.code || 'REQUEST_FAILED',
    );
  return body as T;
}
