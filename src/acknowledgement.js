// Whether this browser has accepted the demo's terms.
//
// Separate from AcknowledgementGate.jsx so that file only exports a component,
// which is what keeps Fast Refresh working.

// Bump the suffix if the terms change materially — every visitor is then asked
// again, which is the point.
export const ACK_STORAGE_KEY = "ucLoopsAckV1";

export function hasAcknowledged() {
  try {
    return window.localStorage.getItem(ACK_STORAGE_KEY) === "1";
  } catch {
    // Private browsing or blocked storage. Reporting "not accepted" means the
    // notice reappears, which is the safe direction to fail in.
    return false;
  }
}

export function rememberAcknowledgement() {
  try {
    window.localStorage.setItem(ACK_STORAGE_KEY, "1");
  } catch {
    // Can't persist it — they'll see the notice again next visit. Acceptable.
  }
}
