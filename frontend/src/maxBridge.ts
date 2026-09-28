/**
 * Best-effort integration point with "MAX Bridge" — the library that lets a
 * MAX mini-app read launch context (platform, launch params) from the host
 * app. See README "Подключение к MAX" — verify the exact global/SDK name
 * against the current MAX Bridge docs before shipping; this file is written
 * defensively so the app works identically as a plain browser page when no
 * bridge is present (this is also how the expert/admin panel is used today,
 * per the brief's requirement that the product work in both MAX and web).
 */

export interface MaxLaunchParams {
  platform?: string; // e.g. "ios" | "android" | "desktop" | "web"
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
