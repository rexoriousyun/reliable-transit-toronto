/**
 * Which theme the app is in, decided once.
 *
 * `D-42` makes dark the default and light an explicit choice. Before this the
 * app followed the system, which meant three places asked
 * `matchMedia("(prefers-color-scheme: dark)")` and could disagree with the
 * stylesheet — the map tokenised one way while the sheet painted the other.
 *
 * The rule is: a stored choice wins, and the absence of one is dark. The system
 * preference is deliberately not consulted. Following it was never a decision
 * (`D-42`), and re-introducing it here as a fallback would put the old
 * behaviour back under a new name.
 */

export type Theme = "dark" | "light";

const KEY = "rt.theme";

/** Address bar and task switcher, so the chrome matches the sheet. */
const BROWSER_CHROME: Record<Theme, string> = {
  dark: "#101014",
  light: "#f2f1ee",
};

export function storedTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    // Private mode, or storage disabled. The default is still a decision.
    return "dark";
  }
}

/**
 * Stamp the theme on the root and tell anything listening.
 *
 * `data-theme` rather than a class because the stylesheet needs it to beat a
 * media query in *both* directions — a light choice on a dark system and the
 * reverse — and attribute selectors on `:root` are how that specificity is won.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", BROWSER_CHROME[theme]);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // A theme that cannot be remembered still applies for this session.
  }
  window.dispatchEvent(new CustomEvent("rt:theme", { detail: theme }));
}

export function isDark(): boolean {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

/** Subscribe to theme changes. Returns the unsubscribe. */
export function onThemeChange(fn: (theme: Theme) => void): () => void {
  const handler = (e: Event): void => fn((e as CustomEvent<Theme>).detail);
  window.addEventListener("rt:theme", handler);
  return () => window.removeEventListener("rt:theme", handler);
}
