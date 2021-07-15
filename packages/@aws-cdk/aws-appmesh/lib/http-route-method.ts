/**
 * Supported values for matching routes based on the HTTP request method
 */
export enum HttpRouteMethod {
  /**
   * GET request
   */
  GET = 'GET',

  /**
   * HEAD request
   */
  HEAD = 'HEAD',

  /**
   * POST request
   */
  POST = 'POST',

  /**
   * PUT request
   */
  PUT = 'PUT',

  /**
   * DELETE request
   */
  DELETE = 'DELETE',

  /**
   * CONNECT request
   */
  CONNECT = 'CONNECT',

  /**
   * OPTIONS request
   */
  OPTIONS = 'OPTIONS',

  /**
   * TRACE request
   */
  TRACE = 'TRACE',

  /**
   * PATCH request
   */
  PATCH = 'PATCH',
}
