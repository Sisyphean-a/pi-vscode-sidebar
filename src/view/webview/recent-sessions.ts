import { effect, signal } from "@preact/signals";
import { h, render } from "preact";
import type { RecentSessionSummary } from "../../shared/recent-sessions.ts";
import {
  formatRecentSessionTime,
  closeRecentSessionsDialog,
  createRecentSessionsPanelState,
  getRecentSessionsRenderState,
  openRecentSessionsDialog,
  selectRecentSession,
  setRecentSessionsVisibility,
  updateRecentSessionsState,
  type RecentSessionsRenderState,
} from "./recent-sessions-state.ts";

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

interface RecentSessionsViewState {
  activeSessionPath: string | undefined;
  renderState: RecentSessionsRenderState;
}

export function createRecentSessionsPanel(
  options: CreateRecentSessionsPanelOptions,
): RecentSessionsPanel {
  const state = createRecentSessionsPanelState();
  const viewStateSignal = signal(buildRecentSessionsViewState(state));

  effect(() => {
    const viewState = viewStateSignal.value;
    renderRecentSessionsDom(
      {
        activeSessionPath: viewState.activeSessionPath,
        dialogList: options.dialogList,
        dialogTitle: options.dialogTitle,
        moreButton: options.moreButton,
        onSelectSession(sessionPath) {
          const selection = selectRecentSession(state, sessionPath);
          refreshViewState();
          if (!selection.shouldSelect) return;
          options.onSelect(sessionPath);
        },
        overlay: options.overlay,
        preview: options.preview,
        section: options.section,
      },
      viewState.renderState,
    );
  });

  const closeDialog = () => {
    closeRecentSessionsDialog(state);
    refreshViewState();
  };

  const openDialog = () => {
    if (!openRecentSessionsDialog(state)) return;
    refreshViewState();
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

  refreshViewState();

  return {
    update(nextSessions, nextActiveSessionPath) {
      updateRecentSessionsState(state, nextSessions, nextActiveSessionPath);
      refreshViewState();
    },
    setVisible(visible) {
      setRecentSessionsVisibility(state, visible);
      refreshViewState();
    },
  };

  function refreshViewState(): void {
    viewStateSignal.value = buildRecentSessionsViewState(state);
  }
}

function buildRecentSessionsViewState(
  state: ReturnType<typeof createRecentSessionsPanelState>,
): RecentSessionsViewState {
  return {
    activeSessionPath: state.activeSessionPath,
    renderState: getRecentSessionsRenderState(state),
  };
}

interface RecentSessionsDomOptions {
  activeSessionPath?: string;
  dialogList: HTMLElement;
  dialogTitle: HTMLElement;
  moreButton: HTMLButtonElement;
  onSelectSession(sessionPath: string): void;
  overlay: HTMLElement;
  preview: HTMLElement;
  section: HTMLElement;
}

function renderRecentSessionsDom(
  options: RecentSessionsDomOptions,
  renderState: RecentSessionsRenderState,
): void {
  options.section.classList.toggle("hidden", renderState.sectionHidden);
  options.overlay.classList.toggle("hidden", !renderState.dialogOpen);
  options.dialogTitle.textContent = renderState.dialogTitleText;
  options.moreButton.textContent = renderState.moreButtonText;
  options.moreButton.classList.toggle("hidden", !renderState.showMoreButton);

  render(
    h(RecentSessionButtonList, {
      activeSessionPath: options.activeSessionPath,
      onSelectSession: options.onSelectSession,
      sessions: renderState.previewSessions,
    }),
    options.preview,
  );

  render(
    h(RecentSessionButtonList, {
      activeSessionPath: options.activeSessionPath,
      onSelectSession: options.onSelectSession,
      sessions: renderState.allSessions,
    }),
    options.dialogList,
  );
}

interface RecentSessionButtonListProps {
  activeSessionPath: string | undefined;
  onSelectSession(sessionPath: string): void;
  sessions: RecentSessionSummary[];
}

function RecentSessionButtonList(props: RecentSessionButtonListProps) {
  return props.sessions.map((session) => {
    const className =
      session.sessionPath === props.activeSessionPath
        ? "recent-session-item is-active"
        : "recent-session-item";
    return h(
      "button",
      {
        class: className,
        key: session.sessionPath,
        onClick() {
          props.onSelectSession(session.sessionPath);
        },
        title: session.title,
        type: "button",
      },
      h("span", { class: "recent-session-item-title" }, session.title),
      h("span", { class: "recent-session-item-time" }, formatRecentSessionTime(session.updatedAt)),
    );
  });
}
