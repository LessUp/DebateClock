export function encodeShare(obj: unknown) {
  const s = JSON.stringify(obj)
  return btoa(unescape(encodeURIComponent(s)))
}

export function decodeShare(s: string) {
  try {
    const json = decodeURIComponent(escape(atob(s)))
    return JSON.parse(json)
  } catch (e) {
    return null
  }
}
