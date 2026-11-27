export enum LandingShot {
  Window = 'window',
  WindowDark = 'window-dark',
  Popover = 'popover',
  WidgetMedium = 'widget-medium',
  AgentTasks = 'agent-tasks',
  WorkspaceLock = 'workspace-lock',
}

export type CropBox = { x: number; y: number; width: number; height: number };

export type WebpCopy = { path: string; width: number };

export type ShotFile = { path: string; width: number; height: number; crop: CropBox | null; webp: WebpCopy[] };

type ShotSource = Omit<ShotFile, 'webp'> & { webpWidths: number[] };

const PNG_EXTENSION = '.png';

function shotOf({ webpWidths, ...source }: ShotSource): ShotFile {
  const stem = source.path.slice(0, -PNG_EXTENSION.length);
  return { ...source, webp: webpWidths.map((width) => ({ path: `${stem}-${width}.webp`, width })) };
}

export const LANDING_SHOTS: Record<LandingShot, ShotFile> = {
  [LandingShot.Window]: shotOf({
    path: '/landing/mac-app-shell/04-inspector-notes-and-history.png',
    width: 1600,
    height: 1013,
    crop: null,
    webpWidths: [760, 1520],
  }),
  [LandingShot.WindowDark]: shotOf({
    path: '/landing/v1-walk/01-agent-tasks-in-a-project.png',
    width: 1600,
    height: 851,
    crop: null,
    webpWidths: [760, 1520],
  }),
  [LandingShot.Popover]: shotOf({
    path: '/landing/menu-bar/01-today-popover.png',
    width: 720,
    height: 728,
    crop: null,
    webpWidths: [311, 622],
  }),
  [LandingShot.WidgetMedium]: shotOf({
    path: '/landing/widgets/03-medium-today.png',
    width: 920,
    height: 532,
    crop: { x: 96, y: 96, width: 728, height: 256 },
    webpWidths: [408, 816],
  }),
  [LandingShot.AgentTasks]: shotOf({
    path: '/landing/mac-sync/01-agent-add-live.png',
    width: 1600,
    height: 1013,
    crop: { x: 322, y: 150, width: 838, height: 364 },
    webpWidths: [828, 1600],
  }),
  [LandingShot.WorkspaceLock]: shotOf({
    path: '/landing/mac-sync/01-agent-add-live.png',
    width: 1600,
    height: 1013,
    crop: { x: 12, y: 20, width: 838, height: 364 },
    webpWidths: [828, 1600],
  }),
};
