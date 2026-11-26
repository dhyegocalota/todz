import {
  type AddedTask,
  type CompletedTask,
  type HistoryEntry,
  type ReopenedTask,
  type Task,
  type TaskList,
  formatShortId,
} from '@todz/core';
import { ActorKind, type TaskState } from '@todz/types';
import { FAIR_USE_COPY } from './fair-use-copy';
import { MCP_COPY } from './mcp-copy';
import type { MovedTask } from './move-task';
import type { ProjectRecord } from './owner-records';
import { type ProjectFailure, ProjectFailureKind } from './project-result';

const LINE_BREAK = '\n';
const PARAGRAPH_BREAK = '\n\n';
const NO_OVERDUE = 0;

function escapedMarkup(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function lines(texts: string[]): string {
  return texts.join(LINE_BREAK);
}

function paragraphs(texts: string[]): string {
  return texts.join(PARAGRAPH_BREAK);
}

function addedLine({ task, replayed }: AddedTask): string {
  if (replayed) return `${MCP_COPY.alreadyAdded} ${taskLine(task)}`;
  return `${MCP_COPY.added} ${taskLine(task)}`;
}

function completedLine({ task, alreadyDone }: CompletedTask): string {
  if (alreadyDone) return `${MCP_COPY.alreadyDone} ${taskLine(task)}`;
  return `${MCP_COPY.done} ${taskLine(task)}`;
}

function reopenedLine({ task, alreadyOpen }: ReopenedTask): string {
  if (alreadyOpen) return `${MCP_COPY.alreadyOpen} ${taskLine(task)}`;
  return `${MCP_COPY.reopened} ${taskLine(task)}`;
}

export function taskLine(task: Task): string {
  const line = `${formatShortId(task.number)} ${task.title}`;
  if (task.dueDate === null) return line;
  return `${line}${MCP_COPY.dueOn(task.dueDate)}`;
}

export function taskBlock(task: Task): string {
  if (task.notes === null) return taskLine(task);
  return paragraphs([taskLine(task), task.notes]);
}

export function listAnswer({ state, list }: { state: TaskState; list: TaskList }): string {
  const header = `${MCP_COPY.stateTasks[state]}: ${MCP_COPY.shownOfMatched({ shown: list.tasks.length, matched: list.totalMatched })}`;
  return lines([header, ...list.tasks.map(taskLine)]);
}

export function addedAnswer(added: AddedTask[]): string {
  return lines(added.map(addedLine));
}

export function updatedAnswer(task: Task): string {
  return `${MCP_COPY.updated} ${taskLine(task)}`;
}

export function completedAnswer(completed: CompletedTask[]): string {
  return lines(completed.map(completedLine));
}

export function showAnswer({ task, arrivalNote }: { task: Task; arrivalNote: string | null | undefined }): string {
  const notes = task.notes === null ? [] : [task.notes];
  const arrival = typeof arrivalNote === 'string' ? [arrivalNote] : [];
  return paragraphs([taskLine(task), MCP_COPY.stateLine(task.state), ...arrival, ...notes]);
}

function historyLineOf(entry: HistoryEntry): string {
  const who = entry.actor.kind === ActorKind.Owner ? MCP_COPY.historyOwner : entry.actor.clientName;
  const fields = entry.fields.length === 0 ? '' : MCP_COPY.historyFields(entry.fields.join(', '));
  const note = entry.note === null ? '' : MCP_COPY.historyNote(entry.note);
  return `${MCP_COPY.historyLine({ at: new Date(entry.at).toISOString(), who, what: `${entry.action}${fields}` })}${note}`;
}

export function historyAnswer(history: HistoryEntry[]): string {
  return lines(history.map(historyLineOf));
}

export function reopenedAnswer(reopened: ReopenedTask[]): string {
  return lines(reopened.map(reopenedLine));
}

export function deletedAnswer(task: Task): string {
  return `${MCP_COPY.deleted} ${taskLine(task)}`;
}

export function movedAnswer({ moved, projectName }: { moved: MovedTask; projectName: string }): string {
  const arrival = MCP_COPY.movedTo({ projectName, shortId: formatShortId(moved.arrived.number) });
  return `${MCP_COPY.moved} ${taskLine(moved.task)} ${arrival}`;
}

export function projectsAnswer({ projects, currentProjectId }: { projects: ProjectRecord[]; currentProjectId: string }): string {
  return lines(
    projects.map((project) => {
      const line = `${project.id} ${project.name}`;
      const inboxMark = project.isInbox ? MCP_COPY.inboxProject : '';
      const currentMark = project.id === currentProjectId ? MCP_COPY.currentProject : '';
      return `${line}${inboxMark}${currentMark}`;
    }),
  );
}

export function nextAnswer(task: Task | null): string {
  if (task === null) return MCP_COPY.noOpenTasks;
  return taskBlock(task);
}

export function nextPromptText(task: Task | null): string {
  if (task === null) return MCP_COPY.nothingToDo;
  const fencedTask = lines([MCP_COPY.taskOpeningTag, escapedMarkup(taskBlock(task)), MCP_COPY.taskClosingTag]);
  return paragraphs([MCP_COPY.workOnTask, fencedTask, MCP_COPY.finishWith(formatShortId(task.number))]);
}

function nudgeSummary({ count, overdue }: { count: number; overdue: number }): string {
  if (overdue === NO_OVERDUE) return MCP_COPY.agentNudge.due(count);
  if (overdue === count) return MCP_COPY.agentNudge.overdue(count);
  return MCP_COPY.agentNudge.dueWithOverdue({ count, overdue });
}

export function nudgeLine({ count, overdue, taskNumber }: { count: number; overdue: number; taskNumber: number }): string {
  return MCP_COPY.agentNudge.line({ summary: nudgeSummary({ count, overdue }), taskId: formatShortId(taskNumber) });
}

export function nudgedText({ nudge, text }: { nudge: string | null; text: string }): string {
  if (nudge === null) return text;
  return paragraphs([nudge, text]);
}

export function failureText(failure: ProjectFailure): string {
  if (failure.kind === ProjectFailureKind.TaskNotFound) return MCP_COPY.taskNotFound(formatShortId(failure.number));
  if (failure.kind === ProjectFailureKind.CursorAhead) throw new Error('the MCP tools never read changes');
  if (failure.kind === ProjectFailureKind.LimitReached) return FAIR_USE_COPY.limitMessageOf({ limit: failure.limit, max: failure.max });
  const sentence = MCP_COPY.ruleIssue[failure.issue];
  if (failure.index === null) return sentence;
  return MCP_COPY.atTaskPosition({ position: failure.index + 1, sentence });
}
