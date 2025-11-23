export function respond(success, message, data = {}) {
  return {
    data: {
      success,
      message,
      data
    }
  };
}
