export type UIPrefs = {
  animations: boolean;
  cosmicBackground: boolean;
  showProfile: boolean;
  showAnalytics: boolean;
  showReflection: boolean;
};

const KEY = "habitlife.ui.prefs.v1";

export const defaultPrefs: UIPrefs = {
  animations: true,
  cosmicBackground: true,
  showProfile: true,
  showAnalytics: true,
  showReflection: true
};

export function loadPrefs(): UIPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<UIPrefs>;
    return { ...defaultPrefs, ...parsed };
  } catch {
    return defaultPrefs;
  }
}

export function savePrefs(next: UIPrefs) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("habitlife:prefs"));
}
