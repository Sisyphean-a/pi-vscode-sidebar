import type { RecentSessionSummary } from "../../shared/recent-sessions.ts";
import {
  formatRecentSessionTime,
  type RecentSessionsRenderState,
} from "./recent-sessions-state.ts";

export interface RecentSessionsDomOptions {
  activeSessionPath?: string;
  dialogList: HTMLElement;
  dialogTitle: HTMLElement;
  moreButton: HTMLButtonElement;
  onSelectSession(sessionPath: string): void;
  overlay: HTMLElement;
  preview: HTMLElement;
  section: HTMLElement;
}

export function renderRecentSessionsDom(
  options: RecentSessionsDomOptions,
  renderState: RecentSessionsRenderState,
): void {
  options.section.classList.toggle("hidden", renderState.sectionHidden);
  options.overlay.classList.toggle("hidden", !renderState.dialogOpen);

  if (renderState.allSessions.length === 0) {
    options.preview.replaceChildren();
    options.dialogList.replaceChildren();
    options.moreButton.classList.add("hidden");
    return;
  }

  options.preview.replaceChildren(
    ...renderState.previewSessions.map((session) =>
      createRecentSessionButton(session, options.activeSessionPath, options.onSelectSession),
    ),
  );
  options.dialogList.replaceChildren(
    ...renderState.allSessions.map((session) =>
      createRecentSessionButton(session, options.activeSessionPath, options.onSelectSession),
    ),
  );

  options.dialogTitle.textContent = renderState.dialogTitleText;
  options.moreButton.textContent = renderState.moreButtonText;
  options.moreButton.classList.toggle("hidden", !renderState.showMoreButton);
}

function createRecentSessionButton(
  session: RecentSessionSummary,
  activeSessionPath: string | undefined,
  onSelectSession: (sessionPath: string) => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "recent-session-item";
  if (session.sessionPath === activeSessionPath) {
    button.classList.add("is-active");
  }
  button.title = session.title;

  const title = document.createElement("span");
  title.className = "recent-session-item-title";
  title.textContent = session.title;

  const time = document.createElement("span");
  time.className = "recent-session-item-time";
  time.textContent = formatRecentSessionTime(session.updatedAt);

  button.append(title, time);
  button.addEventListener("click", () => {
    onSelectSession(session.sessionPath);
  });
  return button;
}
