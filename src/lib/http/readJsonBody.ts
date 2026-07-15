export interface JsonBodySuccess {
  success: true;
  data: unknown;
}

export interface JsonBodyFailure {
  success: false;
  error: string;
  status: 400 | 413;
}

export type JsonBodyResult = JsonBodySuccess | JsonBodyFailure;

/**
 * 在 JSON 解析前限制请求体，避免用超大无关字段绕过业务字段校验。
 */
export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number
): Promise<JsonBodyResult> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      success: false,
      error: 'Request body is too large',
      status: 413,
    };
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { success: false, error: 'Invalid JSON body', status: 400 };
  }

  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    return {
      success: false,
      error: 'Request body is too large',
      status: 413,
    };
  }

  try {
    return { success: true, data: JSON.parse(rawBody) as unknown };
  } catch {
    return { success: false, error: 'Invalid JSON body', status: 400 };
  }
}
