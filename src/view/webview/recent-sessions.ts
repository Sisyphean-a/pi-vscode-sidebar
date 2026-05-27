import type { RecentSessionSummary } from "../../shared/recent-sessions.ts";
import {
  closeRecentSessionsDialog,
  createRecentSessionsPanelState,
  getRecentSessionsRenderState,
  openRecentSessionsDialog,
  selectRecentSession,
  setRecentSessionsVisibility,
  updateRecentSessionsState,
} from "./recent-sessions-state.ts";
import { renderRecentSessionsDom } from "./recent-sessions-dom.ts";

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
  const state = createRecentSessionsPanelState();

  const closeDialog = () => {
    closeRecentSessionsDialog(state);
    renderRecentSessions(options, state, closeDialog);
  };

  const openDialog = () => {
    if (!openRecentSessionsDialog(state)) return;
    renderRecentSessions(options, state, closeDialog);
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
      updateRecentSessionsState(state, nextSessions, nextActiveSessionPath);
      renderRecentSessions(options, state, closeDialog);
    },
    setVisible(visible) {
      setRecentSessionsVisibility(state, visible);
      renderRecentSessions(options, state, closeDialog);
    },
  };
}

function renderRecentSessions(
  options: CreateRecentSessionsPanelOptions,
  state: ReturnType<typeof createRecentSessionsPanelState>,
  closeDialog: () => void,
): void {
  const renderState = getRecentSessionsRenderState(state);
  renderRecentSessionsDom(
    {
      activeSessionPath: state.activeSessionPath,
      dialogList: options.dialogList,
      dialogTitle: options.dialogTitle,
      moreButton: options.moreButton,
      onSelectSession(sessionPath) {
        const selection = selectRecentSession(state, sessionPath);
        closeDialog();
        if (!selection.shouldSelect) return;
        options.onSelect(sessionPath);
      },
      overlay: options.overlay,
      preview: options.preview,
      section: options.section,
    },
    renderState,
  );
}
