import type { RecentSessionSummary } from "../../../../shared/recent-sessions.ts";

const PREVIEW_LIMIT = 3;

export interface RecentSessionsPanelState {
  activeSessionPath: string | undefined;
  dialogOpen: boolean;
  isVisible: boolean;
  sessions: RecentSessionSummary[];
}

export interface RecentSessionsRenderState {
  allSessions: RecentSessionSummary[];
  dialogOpen: boolean;
  dialogTitleText: string;
  moreButtonText: string;
  previewSessions: RecentSessionSummary[];
  sectionHidden: boolean;
  showMoreButton: boolean;
}

export function createRecentSessionsPanelState(): RecentSessionsPanelState {
  return {
    activeSessionPath: undefined,
    dialogOpen: false,
    isVisible: true,
    sessions: [],
  };
}

export function closeRecentSessionsDialog(state: RecentSessionsPanelState): void {
  state.dialogOpen = false;
}

export function formatRecentSessionTime(updatedAt: string, nowMs = Date.now()): string {
  const parsed = Date.parse(updatedAt);
  if (Number.isNaN(parsed)) return "";
  const deltaMs = Math.max(0, nowMs - parsed);
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  const days = Math.floor(hours / 24);
  return `${days} 天`;
}

export function getRecentSessionsRenderState(
  state: RecentSessionsPanelState,
): RecentSessionsRenderState {
  const hasSessions = state.sessions.length > 0;
  return {
    allSessions: [...state.sessions],
    dialogOpen: state.dialogOpen,
    dialogTitleText: `全部任务（${state.sessions.length} 个）`,
    moreButtonText: `查看全部（${state.sessions.length} 个）`,
    previewSessions: state.sessions.slice(0, PREVIEW_LIMIT),
    sectionHidden: !hasSessions || !state.isVisible,
    showMoreButton: state.sessions.length > PREVIEW_LIMIT,
  };
}

export function openRecentSessionsDialog(state: RecentSessionsPanelState): boolean {
  if (state.sessions.length <= PREVIEW_LIMIT) return false;
  state.dialogOpen = true;
  return true;
}

export function selectRecentSession(
  state: RecentSessionsPanelState,
  sessionPath: string,
): { shouldSelect: boolean } {
  state.dialogOpen = false;
  return { shouldSelect: sessionPath !== state.activeSessionPath };
}

export function setRecentSessionsVisibility(
  state: RecentSessionsPanelState,
  visible: boolean,
): void {
  state.isVisible = visible;
  if (!visible) {
    state.dialogOpen = false;
  }
}

export function updateRecentSessionsState(
  state: RecentSessionsPanelState,
  sessions: RecentSessionSummary[],
  activeSessionPath: string | undefined,
): void {
  state.sessions = [...sessions];
  state.activeSessionPath = activeSessionPath;
  if (state.sessions.length === 0) {
    state.dialogOpen = false;
  }
}
