export function respond(ok, msg, data={}) {
  return { ok, message: msg, data };
}