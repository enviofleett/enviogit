export class GPS51RateLimitError extends Error {
  public readonly retryAfter: number;
  public readonly statusCode: number;
  
  constructor(
    message = 'GPS51 API rate limit exceeded (Status 8902)',
    retryAfter = 5000, // Default 5 seconds
    statusCode = 8902
  ) {
    super(message);
    this.name = 'GPS51RateLimitError';
    this.retryAfter = retryAfter;
    this.statusCode = statusCode;
  }
  
  static isRateLimitError(error: any): error is GPS51RateLimitError {
    return error instanceof GPS51RateLimitError || 
           (error && (error.statusCode === 8902 || error.status === 8902));
  }
  
  static fromApiResponse(response: any): GPS51RateLimitError {
    const message = response.message || response.cause || 'GPS51 API rate limit exceeded';
    return new GPS51RateLimitError(`${message} (Status 8902: IP rate limit)`, 5000, 8902);
  }
}