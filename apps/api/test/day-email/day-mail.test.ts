import { describe, expect, test } from 'vitest';
import { type DayMailTask, dayMail } from '../../src/emails/day-mail';

const OWNER_ADDRESS = 'maria@example.com';
const REPLY_ADDRESS = 'reply+0123456789abcdef0123456789abcdef@todz.app';
const ORIGIN = 'https://api.todz.app';
const INBOX_WORKSPACE = 'Personal';
const OPEN_SLOT = '{{';
const LINES_MAX = 20;
const CHOSEN_MINUTES = 420;
const AUTO_SUBMITTED_HEADERS = { 'Auto-Submitted': 'auto-generated' };

function taskOf(overrides: Partial<DayMailTask> = {}): DayMailTask {
  return { number: 12, title: 'Review the release notes', workspaceName: 'Personal', projectName: 'Inbox', isOverdue: false, ...overrides };
}

function mailOf({
  tasks = [taskOf()],
  count = tasks.length,
  hasSeveralWorkspaces = false,
  minutes = CHOSEN_MINUTES,
}: { tasks?: DayMailTask[]; count?: number; hasSeveralWorkspaces?: boolean; minutes?: number } = {}): ReturnType<typeof dayMail> {
  return dayMail({
    to: OWNER_ADDRESS,
    replyTo: REPLY_ADDRESS,
    origin: ORIGIN,
    tasks,
    count,
    workspaceName: INBOX_WORKSPACE,
    hasSeveralWorkspaces,
    minutes,
  });
}

function numberedTasks(total: number): DayMailTask[] {
  return Array.from({ length: total }, (_unused, index) => taskOf({ number: index + 1, title: `Task ${index + 1}` }));
}

describe('the day mail with tasks', () => {
  test('goes to the owner with the reply address as its reply-to and the auto-submitted header', () => {
    const message = mailOf();
    expect(message.to).toBe(OWNER_ADDRESS);
    expect(message.replyTo).toBe(REPLY_ADDRESS);
    expect(message.headers).toEqual(AUTO_SUBMITTED_HEADERS);
  });

  test('counts every due task in its subject, its heading and its preview', () => {
    const message = mailOf({ tasks: numberedTasks(3) });
    expect(message.subject).toBe('Your day: 3 due');
    expect(message.text).toContain('3 due today');
    expect(message.html).toContain('3 due today');
  });

  test('lists a task as its short id, its title and its project', () => {
    const message = mailOf();
    expect(message.text).toContain('T-12 Review the release notes · Inbox');
    expect(message.html).toContain('T-12 Review the release notes · Inbox');
  });

  test('marks an overdue task at the end of its line and no other', () => {
    const message = mailOf({ tasks: [taskOf({ number: 1, title: 'Late', isOverdue: true }), taskOf({ number: 2, title: 'On time' })] });
    expect(message.text).toContain('T-1 Late · Inbox · overdue\nT-2 On time · Inbox');
    expect(message.text).not.toContain('T-2 On time · Inbox · overdue');
  });

  test('names the workspace in front of the project only when the owner has more than one', () => {
    const task = taskOf({ workspaceName: 'Work', projectName: 'todz' });
    expect(mailOf({ tasks: [task], hasSeveralWorkspaces: true }).text).toContain('T-12 Review the release notes · Work / todz');
    expect(mailOf({ tasks: [task], hasSeveralWorkspaces: false }).text).toContain('T-12 Review the release notes · todz');
  });

  test('keeps the lines in the order it was given', () => {
    const message = mailOf({ tasks: numberedTasks(3) });
    expect(message.text).toContain('T-1 Task 1 · Inbox\nT-2 Task 2 · Inbox\nT-3 Task 3 · Inbox');
  });

  test('shows twenty lines and says how many more, the subject still counting all of them', () => {
    const message = mailOf({ tasks: numberedTasks(LINES_MAX + 1) });
    expect(message.subject).toBe('Your day: 21 due');
    expect(message.text).toContain('T-20 Task 20 · Inbox');
    expect(message.text).not.toContain('T-21 Task 21');
    expect(message.text).toContain('and 1 more.');
    expect(message.html).toContain('and 1 more.');
  });

  test('counts the tasks it was not given when a project held more than it listed', () => {
    const message = mailOf({ tasks: numberedTasks(LINES_MAX), count: 130 });
    expect(message.subject).toBe('Your day: 130 due');
    expect(message.text).toContain('and 110 more.');
  });

  test('says no more when it lists them all', () => {
    expect(mailOf({ tasks: numberedTasks(LINES_MAX) }).text).not.toContain(' more.');
  });

  test('escapes a title in the html and keeps it as it is in the text', () => {
    const message = mailOf({ tasks: [taskOf({ title: '<script>alert(1)</script>' })] });
    expect(message.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(message.html).not.toContain('<script>alert(1)');
    expect(message.text).toContain('<script>alert(1)</script>');
  });

  test('writes a title that looks like a slot literally in both parts', () => {
    const message = mailOf({ tasks: [taskOf({ title: '{{link}}' })] });
    expect(message.html).toContain('T-12 {{link}} · Inbox');
    expect(message.text).toContain('T-12 {{link}} · Inbox');
  });

  test('tells the owner to reply from the sign-in address into the Inbox of the first workspace', () => {
    const message = mailOf();
    const hint = 'Reply from the address you sign in with, in one line, to add it to Today in the Inbox of Personal.';
    expect(message.text).toContain(hint);
    expect(message.html).toContain(hint);
  });

  test.each([
    [CHOSEN_MINUTES, '07:00'],
    [0, '00:00'],
    [5, '00:05'],
    [1439, '23:59'],
  ])('says in its footer that it was sent at the minute %i as %s', (minutes, time) => {
    const message = mailOf({ minutes });
    expect(message.text).toContain(`Sent at ${time} because Email me my day is on in todz Settings. Turn it off there.`);
  });

  test('leaves no slot unfilled in either part', () => {
    const message = mailOf({ tasks: numberedTasks(LINES_MAX + 1) });
    expect(message.html).not.toContain(OPEN_SLOT);
    expect(message.text).not.toContain(OPEN_SLOT);
  });
});

describe('the day mail on an empty day', () => {
  test('says nothing is due in its subject and its heading and still carries the reply hint', () => {
    const message = mailOf({ tasks: [], count: 0 });
    expect(message.subject).toBe('Your day: nothing due');
    expect(message.text).toContain('Nothing due today');
    expect(message.text).toContain('Reply from the address you sign in with');
    expect(message.text).not.toContain('T-');
    expect(message.text).not.toContain(' more.');
  });

  test('keeps the reply-to, the header and the footer', () => {
    const message = mailOf({ tasks: [], count: 0 });
    expect(message.replyTo).toBe(REPLY_ADDRESS);
    expect(message.headers).toEqual(AUTO_SUBMITTED_HEADERS);
    expect(message.text).toContain('Sent at 07:00 because Email me my day is on in todz Settings. Turn it off there.');
    expect(message.html).not.toContain(OPEN_SLOT);
  });
});
