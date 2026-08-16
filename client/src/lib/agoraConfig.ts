let _appId: string | null = null;

export async function getAgoraAppId(): Promise<string> {
  if (_appId) return _appId;
  try {
    const r = await fetch("/api/config");
    const d = await r.json();
    _appId = d.agoraAppId || "";
  } catch {
    _appId = "";
  }
  return _appId!;
}

