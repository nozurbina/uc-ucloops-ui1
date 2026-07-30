import { useState } from "react";
import { TRAINING_EMAIL } from "./links.js";

// A mailto link that still does something useful when mailto does nothing.
//
// A bare mailto is a dead end for anyone whose machine has no default mail client
// registered — which is most people using webmail. The browser hands the URL to
// the OS, the OS has no handler, and the click silently does nothing at all. So
// clicking here also copies the address, and says that it did.
//
// The href stays a real mailto, so people who *do* have a client still get it.
export default function ContactEmail({ subject, style, children }) {
  const [copied, setCopied] = useState(false);
  const href = `mailto:${TRAINING_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(TRAINING_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard needs a secure context and can be refused. Nothing to do about
      // it here — the address is on screen either way.
    }
  }

  return (
    <a
      href={href}
      onClick={copy}
      title={`Opens your mail app, and copies ${TRAINING_EMAIL} either way`}
      style={style}
    >
      {copied ? "Address copied ✓" : (children ?? TRAINING_EMAIL)}
    </a>
  );
}
