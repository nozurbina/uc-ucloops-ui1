// Whether this browser has accepted the demo's terms.
//
// Separate from AcknowledgementGate.jsx so that file only exports a component,
// which is what keeps Fast Refresh working.

// Bump the suffix if the terms change materially — every visitor is then asked
// again, which is the point.
//
// V1 -> V2: V1 told people their conversations were never stored. V2 discloses
// that submissions are retained for 30 days and analysed. Consent to V1 is not
// consent to V2, so the bump is required, not housekeeping.
export const ACK_STORAGE_KEY = "ucLoopsAckV2";

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
