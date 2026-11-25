import { DueWindow, LIST_LIMIT_MAX, TaskState } from '@todz/types';
import type { DayMailTask } from '../emails/day-mail';
import type { ScheduledWorkspace } from '../project-routing';

export type DueToday = { tasks: DayMailTask[]; count: number };

const TODAY_FILTER = { state: TaskState.Open, dueWindows: [DueWindow.Overdue, DueWindow.Today], text: null, limit: LIST_LIMIT_MAX };

export async function dueTodayOf({ workspaces, today }: { workspaces: ScheduledWorkspace[]; today: string }): Promise<DueToday> {
  const reads = await Promise.all(
    workspaces.flatMap(({ workspace, projects }) =>
      projects.map(async ({ record, project }) => {
        const result = await project.listTasks({ today, filter: TODAY_FILTER });
        if (!result.ok) throw new Error('a project could not list its tasks');
        return { workspace, record, list: result.value };
      }),
    ),
  );
  return {
    count: reads.reduce((total, { list }) => total + list.totalMatched, 0),
    tasks: reads.flatMap(({ workspace, record, list }) =>
      list.tasks.map((task) => ({
        number: task.number,
        title: task.title,
        workspaceName: workspace.name,
        projectName: record.name,
        isOverdue: task.dueDate !== null && task.dueDate < today,
      })),
    ),
  };
}
