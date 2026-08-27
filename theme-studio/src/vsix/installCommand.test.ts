import { describe, expect, it } from 'vitest'
import { detectOS, installCommandFor } from './installCommand'

function fakeNavigator(overrides: Partial<Navigator & { userAgentData?: { platform?: string } }>): Navigator {
  return { platform: '', userAgent: '', ...overrides } as Navigator
}

describe('detectOS', () => {
  it('detects macOS from userAgentData.platform', () => {
    expect(detectOS(fakeNavigator({ userAgentData: { platform: 'macOS' } }))).toBe('mac')
  })

  it('detects Windows from userAgentData.platform', () => {
    expect(detectOS(fakeNavigator({ userAgentData: { platform: 'Windows' } }))).toBe('windows')
  })

  it('detects Linux from userAgentData.platform', () => {
    expect(detectOS(fakeNavigator({ userAgentData: { platform: 'Linux' } }))).toBe('linux')
  })

  it('falls back to navigator.platform when userAgentData is absent', () => {
    expect(detectOS(fakeNavigator({ platform: 'MacIntel' }))).toBe('mac')
  })

  it('falls back to the user agent string when platform is unhelpful', () => {
    expect(
      detectOS(fakeNavigator({ platform: '', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })),
    ).toBe('windows')
  })

  it('returns unknown when nothing matches', () => {
    expect(detectOS(fakeNavigator({ platform: 'SomeOtherOS', userAgent: 'weird-browser' }))).toBe('unknown')
  })
})

describe('installCommandFor', () => {
  it('uses a ~/Downloads path on macOS', () => {
    expect(installCommandFor('mac', 'my-theme.vsix')).toBe('code --install-extension ~/Downloads/my-theme.vsix')
  })

  it('uses a ~/Downloads path on Linux', () => {
    expect(installCommandFor('linux', 'my-theme.vsix')).toBe('code --install-extension ~/Downloads/my-theme.vsix')
  })

  it('uses a PowerShell-style path on Windows', () => {
    expect(installCommandFor('windows', 'my-theme.vsix')).toBe(
      'code --install-extension $env:USERPROFILE\\Downloads\\my-theme.vsix',
    )
  })

  it('uses a generic placeholder path when the OS is unknown', () => {
    expect(installCommandFor('unknown', 'my-theme.vsix')).toContain('my-theme.vsix')
  })
})
