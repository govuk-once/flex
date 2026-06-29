export function isClientError(status: number) {
  return status >= 400 && status < 500;
}

export function isServerError(status: number) {
  return status >= 500;
}
