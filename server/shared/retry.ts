/**
 * Retry Utility for External API Calls
 * 
 * Implements exponential backoff retry logic for resilient API integration.
 * Used for shipping provider APIs, payment gateways, and other external services.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  exponentialBackoff?: boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryableError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

/**
 * Execute a function with retry logic
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Promise with function result
 * 
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => shippingProvider.createShipment(data),
 *   {
 *     maxRetries: 3,
 *     onRetry: (error, attempt) => {
 *       console.log(`Retry attempt ${attempt}: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    exponentialBackoff = true,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on NonRetryableError
      if (lastError instanceof NonRetryableError) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = exponentialBackoff
        ? Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        : baseDelay;

      // Add jitter (±20%) to prevent thundering herd
      const jitter = delay * 0.2 * (Math.random() - 0.5);
      const finalDelay = Math.floor(delay + jitter);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      console.log(
        `⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${finalDelay}ms: ${lastError.message}`
      );

      // Wait before retry
      await sleep(finalDelay);
    }
  }

  throw new RetryableError(
    `Failed after ${maxRetries + 1} attempts: ${lastError!.message}`,
    lastError!
  );
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with specific error handling
 * 
 * Allows custom logic to determine if an error is retryable
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  isRetryable: (error: Error) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(async () => {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      if (!isRetryable(err)) {
        throw new NonRetryableError(err.message, err);
      }
      
      throw new RetryableError(err.message, err);
    }
  }, options);
}
