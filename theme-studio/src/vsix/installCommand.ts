// VS Code's `vscode://` URI scheme can open a file/folder by absolute path,
// or install a *published Marketplace* extension by publisher.name — it
// cannot install an arbitrary local, unpublished .vsix, and a browser can't
// read back the absolute path a file was just saved to. True one-click
// auto-install isn't achievable client-side, so this only ever produces a
// command to show and copy, never one this app runs itself.

export type DetectedOS = 'mac' | 'windows' | 'linux' | 'unknown';

interface NavigatorWithUAData extends Navigator {
  userAgentData?: { platform?: string };
}

/** Best-effort OS guess from the browser — used only to tailor the *shown* command, never to change app behavior, so a wrong guess just means the user edits one line. */
export function detectOS(nav: Navigator = navigator): DetectedOS {
  // `userAgentData.platform` is the more honest modern signal (Chromium),
  // but isn't implemented everywhere yet — `navigator.platform` (deprecated
  // but still populated) and the UA string are the necessary fallbacks.
  const platform = (nav as NavigatorWithUAData).userAgentData?.platform || nav.platform || '';
  const ua = nav.userAgent || '';
  if (/mac/i.test(platform) || /Mac OS X/i.test(ua)) return 'mac';
  if (/win/i.test(platform) || /Windows/i.test(ua)) return 'windows';
  if (/linux/i.test(platform) || /Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

/**
 * The `code --install-extension` command for `filename`, tailored to the OS's
 * default Downloads path. This is a *guess*, not a guarantee — a
 * user-configured download folder still means manual adjustment, which the
 * surrounding UI says explicitly rather than overpromising.
 */
export function installCommandFor(os: DetectedOS, filename: string): string {
  switch (os) {
    case 'mac':
    case 'linux':
      return `code --install-extension ~/Downloads/${filename}`;
    case 'windows':
      // PowerShell is VS Code's own default terminal on Windows; `$env:USERPROFILE`
      // resolves correctly there without needing the actual username.
      return `code --install-extension $env:USERPROFILE\\Downloads\\${filename}`;
    case 'unknown':
      return `code --install-extension <path-to-your-downloads-folder>/${filename}`;
  }
}
