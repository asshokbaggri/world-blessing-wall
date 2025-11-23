export function respond(success, message, data = {}) {
  return { success, message, ...data };
}
