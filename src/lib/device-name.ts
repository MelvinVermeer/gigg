// A human label for the device a passkey is created on, e.g. "Safari on iOS".
// ponytail: coarse UA sniffing, only used as a label; unknowns fall back to "Browser"/"unknown device".
export function deviceName(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\/|FxiOS/.test(ua)
      ? 'Firefox'
      : /Chrome\/|CriOS/.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown device'
  return `${browser} on ${os}`
}
