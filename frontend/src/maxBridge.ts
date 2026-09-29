export interface MaxLaunchParams {
  platform?: string;
  chatId?: string;
  userId?: string;
}

declare global {
  interface Window {
    MAXBridge?: {
      getLaunchParams?: () => MaxLaunchParams | Promise<MaxLaunchParams>;
    };
  }
}

export function isRunningInsideMax(): boolean {
  return typeof window !== "undefined" && !!window.MAXBridge;
}

export async function getMaxLaunchParams(): Promise<MaxLaunchParams | null> {
  if (!isRunningInsideMax()) return null;
  try {
    const params = await window.MAXBridge!.getLaunchParams?.();
    return params ?? null;
  } catch {
    return null;
  }
}
