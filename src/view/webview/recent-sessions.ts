import type { RecentSessionSummary } from "../../shared/recent-sessions.ts";

const PREVIEW_LIMIT = 3;

export interface RecentSessionsPanel {
  update(sessions: RecentSessionSummary[], activeSessionPath?: string): void;
  setVisible(visible: boolean): void;
}

interface CreateRecentSessionsPanelOptions {
  section: HTMLElement;
  preview: HTMLElement;
  moreButton: HTMLButtonElement;
  overlay: HTMLElement;
  dialogTitle: HTMLElement;
  dialogList: HTMLElement;
  closeButton: HTMLButtonElement;
  onSelect(sessionPath: string): void;
}

export function createRecentSessionsPanel(
  options: CreateRecentSessionsPanelOptions,
): RecentSessionsPanel {
  let sessions: RecentSessionSummary[] = [];
  let activeSessionPath: string | undefined;
  let isVisible = true;

  const closeDialog = () => {
    options.overlay.classList.add("hidden");
  };

  const openDialog = () => {
    if (sessions.length <= PREVIEW_LIMIT) return;
    options.overlay.classList.remove("hidden");
  };

  options.moreButton.addEventListener("click", () => {
    openDialog();
  });
  options.closeButton.addEventListener("click", () => {
    closeDialog();
  });
  options.overlay.addEventListener("click", (event) => {
    if (event.target === options.overlay) {
      closeDialog();
    }
  });

  return {
    update(nextSessions, nextActiveSessionPath) {
      sessions = [...nextSessions];
      activeSessionPath = nextActiveSessionPath;
      renderRecentSessions(options, sessions, activeSessionPath, isVisible, closeDialog);
    },
    setVisible(visible) {
      isVisible = visible;
      renderRecentSessions(options, sessions, activeSessionPath, isVisible, closeDialog);
    },
  };
}

function renderRecentSessions(
  options: CreateRecentSessionsPanelOptions,
  sessions: RecentSessionSummary[],
  activeSessionPath: string | undefined,
  isVisible: boolean,
  closeDialog: () => void,
): void {
  const hasSessions = sessions.length > 0;
  options.section.classList.toggle("hidden", !hasSessions || !isVisible);

  if (!hasSessions) {
    options.preview.replaceChildren();
    options.dialogList.replaceChildren();
    options.moreButton.classList.add("hidden");
    closeDialog();
    return;
  }

  if (!isVisible) {
    closeDialog();
  }

  options.preview.replaceChildren(
    ...sessions
      .slice(0, PREVIEW_LIMIT)
      .map((session) =>
        createSessionButton(session, activeSessionPath, closeDialog, options.onSelect),
      ),
  );
  options.dialogList.replaceChildren(
    ...sessions.map((session) =>
      createSessionButton(session, activeSessionPath, closeDialog, options.onSelect),
    ),
  );

  options.dialogTitle.textContent = `全部任务（${sessions.length} 个）`;
  options.moreButton.textContent = `查看全部（${sessions.length} 个）`;
  options.moreButton.classList.toggle("hidden", sessions.length <= PREVIEW_LIMIT);
}

function createSessionButton(
  session: RecentSessionSummary,
  activeSessionPath: string | undefined,
  closeDialog: () => void,
  onSelect: (sessionPath: string) => void,
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
    closeDialog();
    if (session.sessionPath === activeSessionPath) return;
    onSelect(session.sessionPath);
  });
  return button;
}

function formatRecentSessionTime(updatedAt: string): string {
  const parsed = Date.parse(updatedAt);
  if (Number.isNaN(parsed)) return "";
  const deltaMs = Math.max(0, Date.now() - parsed);
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  const days = Math.floor(hours / 24);
  return `${days} 天`;
}
