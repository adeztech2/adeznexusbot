/**
 * Global send queue — ensures sock.sendMessage is called at a controlled rate
 * so WhatsApp never returns rate-overlimit errors.
 *
 * All outgoing sends go through enqueue(); they are processed one-at-a-time
 * with a minimum gap of SEND_INTERVAL_MS between each.
 */

const SEND_INTERVAL_MS = 400; // max ~2.5 messages/sec — safe for WhatsApp

const queue  = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;

  while (queue.length > 0) {
    const { fn, resolve, reject } = queue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    }
    if (queue.length > 0) {
      await new Promise(r => setTimeout(r, SEND_INTERVAL_MS));
    }
  }

  draining = false;
}

/**
 * Enqueue a send operation. Returns a Promise that resolves with the result
 * of fn() once it has been executed (in order, rate-limited).
 *
 * @param {() => Promise<any>} fn
 */
export function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    drain();
  });
}

/**
 * Patched sock.sendMessage that goes through the rate-limited queue.
 * Call patchSock(sock) once after creating the socket to install it.
 */
export function patchSock(sock) {
  const original = sock.sendMessage.bind(sock);
  sock.sendMessage = (...args) => enqueue(() => original(...args));
  return sock;
}
