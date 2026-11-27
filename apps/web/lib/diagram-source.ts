export function isSafeDiagramSource(source: string): boolean {
  if (source.length > 10_000 || source.includes('\\') || (source.match(/-->|---|==>|-\.->/g)?.length ?? 0) > 100) return false;
  // CSS escapes can hide URLs; message diagrams stay local and cannot change renderer settings.
  return !/%%\{|^\s*---|\b(?:https?|data|javascript|file|ftp):|\/\/|\bclick\s|\b(?:img|image|icon)\s*:|url\s*\(|<\/?[a-z][^>]*>/im.test(source);
}
