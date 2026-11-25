export enum LandingShot {
  Window = 'window',
  WindowDark = 'window-dark',
  Popover = 'popover',
  WidgetMedium = 'widget-medium',
  WidgetRing = 'widget-ring',
  AgentTasks = 'agent-tasks',
}

export type CropBox = { x: number; y: number; width: number; height: number };

export type ShotFile = { path: string; width: number; height: number; crop: CropBox | null };

export const LANDING_SHOTS: Record<LandingShot, ShotFile> = {
  [LandingShot.Window]: { path: '/landing/mac-app-shell/04-inspector-notes-and-history.png', width: 1600, height: 1013, crop: null },
  [LandingShot.WindowDark]: { path: '/landing/v1-walk/01-agent-tasks-in-a-project.png', width: 1600, height: 851, crop: null },
  [LandingShot.Popover]: { path: '/landing/menu-bar/01-today-popover.png', width: 720, height: 728, crop: null },
  [LandingShot.WidgetMedium]: {
    path: '/landing/widgets/03-medium-today.png',
    width: 920,
    height: 532,
    crop: { x: 96, y: 96, width: 728, height: 340 },
  },
  [LandingShot.WidgetRing]: {
    path: '/landing/widgets/01-today-ring.png',
    width: 532,
    height: 532,
    crop: { x: 96, y: 96, width: 340, height: 340 },
  },
  [LandingShot.AgentTasks]: {
    path: '/landing/mac-sync/01-agent-add-live.png',
    width: 1600,
    height: 1013,
    crop: { x: 322, y: 150, width: 838, height: 364 },
  },
};
