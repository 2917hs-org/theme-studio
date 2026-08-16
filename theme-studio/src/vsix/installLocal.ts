// A browser page has no API to silently install a local file into another
// application — that gap is deliberate sandboxing, not a bug we can code
// around. We used to guess whether VS Code opened via a hidden iframe +
// `vscode://` + watching for a focus/visibility change, but that signal is
// unreliable (it fires on plain tab-switching too) and made the UI claim
// things it couldn't actually confirm. The honest version of this feature
// is: download the packaged .vsix and hand the user the exact one-line
// command to finish the install themselves.

/** The exact command that finishes the install, once VS Code is open. */
export function installCommandFor(filename: string): string {
  return `code --install-extension ~/Downloads/${filename}`;
}

/** Best-effort clipboard write — clipboard access can be denied or absent (insecure context, permissions), which is not fatal to the install flow. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
