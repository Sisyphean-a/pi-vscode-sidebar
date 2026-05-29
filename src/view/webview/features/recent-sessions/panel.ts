import { h } from "preact";
import type { RecentSessionSummary } from "../../../../shared/recent-sessions.ts";
import type { PreactRenderPort } from "../../ui/preact-render-port.ts";
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
} from "./state.ts";

export interface RecentSessionsPanel {
  update(sessions: RecentSessionSummary[], activeSessionPath?: string): void;
  setVisible(visible: boolean): void;
}

interface CreateRecentSessionsPanelOptions {
  onSelect(sessionPath: string): void;
  overlayView: PreactRenderPort;
  sectionView: PreactRenderPort;
}

interface RecentSessionsViewState {
  activeSessionPath: string | undefined;
  renderState: RecentSessionsRenderState;
}

export function createRecentSessionsPanel(
  options: CreateRecentSessionsPanelOptions,
): RecentSessionsPanel {
  const state = createRecentSessionsPanelState();
  let viewState = buildRecentSessionsViewState(state);
  let renderedViewState: RecentSessionsViewState | undefined;
  const closeDialog = () => {
    closeRecentSessionsDialog(state);
    refreshViewState();
  };
  const openDialog = () => {
    if (!openRecentSessionsDialog(state)) return;
    refreshViewState();
  };
  const selectSession = (sessionPath: string) => {
    const selection = selectRecentSession(state, sessionPath);
    refreshViewState();
    if (!selection.shouldSelect) return;
    options.onSelect(sessionPath);
  };
  const renderView = () => {
    options.sectionView.render(
      h(RecentSessionsSection, {
        activeSessionPath: viewState.activeSessionPath,
        onOpenDialog: openDialog,
        onSelectSession: selectSession,
        renderState: viewState.renderState,
      }),
    );
    options.overlayView.render(
      h(RecentSessionsOverlay, {
        activeSessionPath: viewState.activeSessionPath,
        onCloseDialog: closeDialog,
        onSelectSession: selectSession,
        renderState: viewState.renderState,
      }),
    );
  };

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
    const nextViewState = buildRecentSessionsViewState(state);
    if (isRecentSessionsViewStateEqual(renderedViewState, nextViewState)) return;
    viewState = nextViewState;
    renderedViewState = nextViewState;
    renderView();
  }
}

interface RecentSessionsSectionProps {
  activeSessionPath: string | undefined;
  onOpenDialog(): void;
  onSelectSession(sessionPath: string): void;
  renderState: RecentSessionsRenderState;
}

function RecentSessionsSection(props: RecentSessionsSectionProps) {
  if (props.renderState.sectionHidden) return null;

  return h(
    "section",
    {
      class: "recent-sessions recent-sessions-stream",
      "aria-label": "最近任务",
    },
    h(
      "div",
      { class: "recent-sessions-preview" },
      h(RecentSessionButtonList, {
        activeSessionPath: props.activeSessionPath,
        onSelectSession: props.onSelectSession,
        sessions: props.renderState.previewSessions,
      }),
    ),
    props.renderState.showMoreButton
      ? h(
          "button",
          {
            class: "recent-sessions-more recent-sessions-link",
            onClick: props.onOpenDialog,
            type: "button",
          },
          props.renderState.moreButtonText,
        )
      : null,
  );
}

interface RecentSessionsOverlayProps {
  activeSessionPath: string | undefined;
  onCloseDialog(): void;
  onSelectSession(sessionPath: string): void;
  renderState: RecentSessionsRenderState;
}

function RecentSessionsOverlay(props: RecentSessionsOverlayProps) {
  if (!props.renderState.dialogOpen) return null;

  return h(
    "div",
    {
      class: "recent-sessions-overlay",
      onClick(event) {
        if (event.target === event.currentTarget) {
          props.onCloseDialog();
        }
      },
    },
    h(
      "section",
      {
        class: "recent-sessions-dialog",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "recent-sessions-dialog-title",
      },
      h(
        "div",
        { class: "recent-sessions-dialog-header" },
        h("h2", { id: "recent-sessions-dialog-title" }, props.renderState.dialogTitleText),
        h(
          "button",
          {
            class: "icon-action",
            onClick: props.onCloseDialog,
            title: "关闭",
            type: "button",
          },
          "关闭",
        ),
      ),
      h(
        "div",
        { class: "recent-sessions-dialog-list" },
        h(RecentSessionButtonList, {
          activeSessionPath: props.activeSessionPath,
          onSelectSession: props.onSelectSession,
          sessions: props.renderState.allSessions,
        }),
      ),
    ),
  );
}

function buildRecentSessionsViewState(
  state: ReturnType<typeof createRecentSessionsPanelState>,
): RecentSessionsViewState {
  return {
    activeSessionPath: state.activeSessionPath,
    renderState: getRecentSessionsRenderState(state),
  };
}

function isRecentSessionsViewStateEqual(
  left: RecentSessionsViewState | undefined,
  right: RecentSessionsViewState,
): boolean {
  if (!left) return false;
  return (
    left.activeSessionPath === right.activeSessionPath &&
    isRecentSessionsRenderStateEqual(left.renderState, right.renderState)
  );
}

function isRecentSessionsRenderStateEqual(
  left: RecentSessionsRenderState,
  right: RecentSessionsRenderState,
): boolean {
  return (
    left.sectionHidden === right.sectionHidden &&
    left.dialogOpen === right.dialogOpen &&
    left.showMoreButton === right.showMoreButton &&
    left.moreButtonText === right.moreButtonText &&
    left.dialogTitleText === right.dialogTitleText &&
    isSessionListEqual(left.previewSessions, right.previewSessions) &&
    isSessionListEqual(left.allSessions, right.allSessions)
  );
}

function isSessionListEqual(
  left: readonly RecentSessionSummary[],
  right: readonly RecentSessionSummary[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftSession = left[index];
    const rightSession = right[index];
    if (!leftSession || !rightSession) return false;
    if (
      leftSession.sessionPath !== rightSession.sessionPath ||
      leftSession.updatedAt !== rightSession.updatedAt ||
      leftSession.title !== rightSession.title
    ) {
      return false;
    }
  }
  return true;
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
