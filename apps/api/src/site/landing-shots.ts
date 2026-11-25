export enum LandingShot {
  Window = 'window',
  WindowDark = 'window-dark',
  Popover = 'popover',
  WidgetMedium = 'widget-medium',
  WidgetRing = 'widget-ring',
  AgentTasks = 'agent-tasks',
}

export type CropBox = { x: number; y: number; width: number; height: number };

export type WebpCopy = { path: string; width: number };

export type ShotFile = { path: string; width: number; height: number; crop: CropBox | null; webp: WebpCopy[] };

const PNG_EXTENSION = '.png';
const WINDOW_PATH = '/landing/mac-app-shell/04-inspector-notes-and-history.png';
const WINDOW_DARK_PATH = '/landing/v1-walk/01-agent-tasks-in-a-project.png';
const POPOVER_PATH = '/landing/menu-bar/01-today-popover.png';
const WIDGET_MEDIUM_PATH = '/landing/widgets/03-medium-today.png';
const WIDGET_RING_PATH = '/landing/widgets/01-today-ring.png';
const AGENT_TASKS_PATH = '/landing/mac-sync/01-agent-add-live.png';

function webpCopies({ path, widths }: { path: string; widths: number[] }): WebpCopy[] {
  return widths.map((width) => ({ path: `${path.slice(0, -PNG_EXTENSION.length)}-${width}.webp`, width }));
}

export const LANDING_SHOTS: Record<LandingShot, ShotFile> = {
  [LandingShot.Window]: {
    path: WINDOW_PATH,
    width: 1600,
    height: 1013,
    crop: null,
    webp: webpCopies({ path: WINDOW_PATH, widths: [760, 1520] }),
  },
  [LandingShot.WindowDark]: {
    path: WINDOW_DARK_PATH,
    width: 1600,
    height: 851,
    crop: null,
    webp: webpCopies({ path: WINDOW_DARK_PATH, widths: [760, 1520] }),
  },
  [LandingShot.Popover]: {
    path: POPOVER_PATH,
    width: 720,
    height: 728,
    crop: null,
    webp: webpCopies({ path: POPOVER_PATH, widths: [311, 622] }),
  },
  [LandingShot.WidgetMedium]: {
    path: WIDGET_MEDIUM_PATH,
    width: 920,
    height: 532,
    crop: { x: 96, y: 96, width: 728, height: 340 },
    webp: webpCopies({ path: WIDGET_MEDIUM_PATH, widths: [408, 816] }),
  },
  [LandingShot.WidgetRing]: {
    path: WIDGET_RING_PATH,
    width: 532,
    height: 532,
    crop: { x: 96, y: 96, width: 340, height: 340 },
    webp: webpCopies({ path: WIDGET_RING_PATH, widths: [182, 364] }),
  },
  [LandingShot.AgentTasks]: {
    path: AGENT_TASKS_PATH,
    width: 1600,
    height: 1013,
    crop: { x: 322, y: 150, width: 838, height: 364 },
    webp: webpCopies({ path: AGENT_TASKS_PATH, widths: [828, 1600] }),
  },
};
