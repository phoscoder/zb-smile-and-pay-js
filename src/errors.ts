/** Base class for every error thrown by the SDK. */
export class SmileAndPayError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SmileAndPayError';
  }
}

/**
 * The API answered, but with a failure: a non-2xx HTTP status, or a 2xx
 * body whose `responseCode` is not success (the gateway reports most
 * business failures with HTTP 200).
 */
export class SmileAndPayApiError extends SmileAndPayError {
  /** HTTP status code. */
  readonly status: number;
  /** Gateway `responseCode`, when the body contains one. */
  readonly responseCode: string | undefined;
  /** Parsed response body (JSON object or raw text). */
  readonly body: unknown;

  constructor(message: string, init: { status: number; responseCode?: string; body: unknown }) {
    super(message);
    this.name = 'SmileAndPayApiError';
    this.status = init.status;
    this.responseCode = init.responseCode;
    this.body = init.body;
  }
}

/** HTTP 401 / 403, or responseCode `04`: the API key or secret was rejected. */
export class SmileAndPayAuthenticationError extends SmileAndPayApiError {
  constructor(message: string, init: { status: number; responseCode?: string; body: unknown }) {
    super(message, init);
    this.name = 'SmileAndPayAuthenticationError';
  }
}

/** The request never got a response: network failure, DNS, or timeout. */
export class SmileAndPayConnectionError extends SmileAndPayError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SmileAndPayConnectionError';
  }
}

/** The request exceeded the configured timeout. */
export class SmileAndPayTimeoutError extends SmileAndPayConnectionError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SmileAndPayTimeoutError';
  }
}
