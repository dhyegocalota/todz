import { DAY_EMAIL_PROJECTS_PER_OWNER_MAX, DAY_EMAIL_SENDS_PER_TICK_MAX, type Language } from '@todz/types';
import { type EmailSender, emailSenderForOrigin } from '../email-sender';
import { dayMail } from '../emails/day-mail';
import type { Env } from '../env';
import { type DayEmailCandidate, listDayEmailCandidates, listScheduledWorkspaces } from '../project-routing';
import { publicOriginOf } from '../sign-in-links';
import { dueDayOf } from './day-email-due';
import { DayEmailEvent, logDayEmailEvent } from './day-email-log';
import { issueReplyAddress } from './day-email-reply-address';
import { issueStopLink } from './day-email-stop-link';
import { DayEmailFailure, claimDay, markFailed, markSent, pruneDayEmails } from './day-email-store';
import { dueTodayOf } from './day-email-today';

export enum DayEmailMissingPiece {
  PublicOrigin = 'public_origin',
  EmailSender = 'email_sender',
}

enum OwnerOutcome {
  Skipped = 'skipped',
  Sent = 'sent',
  Failed = 'failed',
}

type DayEmailRun = { scheduledTime: number; env: Env };

type DueOwner = { candidate: DayEmailCandidate; day: string; language: Language };

type OwnerMail = DayEmailRun & { dueOwner: DueOwner; sender: EmailSender; publicOrigin: string };

class DayEmailFailureError extends Error {
  constructor(readonly failure: DayEmailFailure) {
    super(failure);
  }
}

async function failingWith<Value>({ failure, run }: { failure: DayEmailFailure; run: () => Promise<Value> }): Promise<Value> {
  try {
    return await run();
  } catch {
    throw new DayEmailFailureError(failure);
  }
}

async function deliverDay({ scheduledTime, env, dueOwner, sender, publicOrigin }: OwnerMail): Promise<void> {
  const { candidate, day } = dueOwner;
  const { workspaces, inboxWorkspace } = await failingWith({
    failure: DayEmailFailure.ReadFailed,
    async run() {
      const listed = await listScheduledWorkspaces({ env, owner: candidate.owner });
      if (listed === null) throw new Error('the owner is not a scheduled owner');
      const [firstWorkspace] = listed;
      if (firstWorkspace === undefined) throw new Error('the owner lists no workspace');
      return { workspaces: listed, inboxWorkspace: firstWorkspace.workspace };
    },
  });
  const projectCount = workspaces.reduce((total, { projects }) => total + projects.length, 0);
  if (projectCount > DAY_EMAIL_PROJECTS_PER_OWNER_MAX) throw new DayEmailFailureError(DayEmailFailure.TooManyProjects);
  const dueToday = await failingWith({ failure: DayEmailFailure.ReadFailed, run: () => dueTodayOf({ workspaces, today: day }) });
  await failingWith({
    failure: DayEmailFailure.SendFailed,
    async run() {
      const replyTo = await issueReplyAddress({ directory: env.DIRECTORY, ownerId: candidate.owner.ownerId, now: scheduledTime });
      const stopToken = await issueStopLink({ directory: env.DIRECTORY, ownerId: candidate.owner.ownerId, now: scheduledTime });
      await sender.send(
        dayMail({
          to: candidate.address,
          replyTo,
          origin: publicOrigin,
          stopToken,
          tasks: dueToday.tasks,
          count: dueToday.count,
          workspaceName: inboxWorkspace.name,
          hasSeveralWorkspaces: workspaces.length > 1,
          minutes: candidate.minutes,
          language: dueOwner.language,
        }),
      );
    },
  });
}

async function failureOf(ownerMail: OwnerMail): Promise<DayEmailFailure | null> {
  try {
    await deliverDay(ownerMail);
    return null;
  } catch (error) {
    if (error instanceof DayEmailFailureError) return error.failure;
    throw error;
  }
}

async function mailClaimedOwner(ownerMail: OwnerMail): Promise<OwnerOutcome> {
  const { env, dueOwner } = ownerMail;
  const owner = { directory: env.DIRECTORY, ownerId: dueOwner.candidate.owner.ownerId, day: dueOwner.day, now: Date.now() };
  const failure = await failureOf(ownerMail);
  if (failure === null) {
    await markSent(owner);
    return OwnerOutcome.Sent;
  }
  await markFailed({ ...owner, failure });
  return OwnerOutcome.Failed;
}

async function mailDueOwner(ownerMail: OwnerMail): Promise<OwnerOutcome> {
  const { scheduledTime, env, dueOwner } = ownerMail;
  try {
    const isClaimed = await claimDay({
      directory: env.DIRECTORY,
      ownerId: dueOwner.candidate.owner.ownerId,
      day: dueOwner.day,
      now: scheduledTime,
    });
    if (!isClaimed) return OwnerOutcome.Skipped;
    return await mailClaimedOwner(ownerMail);
  } catch {
    return OwnerOutcome.Failed;
  }
}

function mailDueOwners({
  dueOwners,
  mail,
}: {
  dueOwners: DueOwner[];
  mail: (dueOwner: DueOwner) => Promise<OwnerOutcome>;
}): Promise<OwnerOutcome[]> {
  return dueOwners.reduce<Promise<OwnerOutcome[]>>(async (previous, dueOwner) => {
    const outcomes = await previous;
    const attempts = outcomes.filter((outcome) => outcome !== OwnerOutcome.Skipped).length;
    if (attempts >= DAY_EMAIL_SENDS_PER_TICK_MAX) return outcomes;
    return [...outcomes, await mail(dueOwner)];
  }, Promise.resolve([]));
}

function countOf({ outcomes, outcome }: { outcomes: OwnerOutcome[]; outcome: OwnerOutcome }): number {
  return outcomes.filter((candidate) => candidate === outcome).length;
}

function failureMessageOf(failed: number): string {
  return `the day email failed for ${failed} ${failed === 1 ? 'owner' : 'owners'}`;
}

export async function runDayEmails({ scheduledTime, env }: DayEmailRun): Promise<void> {
  const publicOrigin = publicOriginOf(env.PUBLIC_ORIGIN);
  const sender = emailSenderForOrigin({ env, origin: publicOrigin });
  const isPresent: Record<DayEmailMissingPiece, boolean> = {
    [DayEmailMissingPiece.PublicOrigin]: publicOrigin !== null,
    [DayEmailMissingPiece.EmailSender]: sender !== null,
  };
  if (publicOrigin === null || sender === null) {
    const missingPieces = Object.values(DayEmailMissingPiece).filter((piece) => !isPresent[piece]);
    throw new Error(`the day email is missing ${missingPieces.join(', ')}`);
  }
  await pruneDayEmails({ directory: env.DIRECTORY, now: scheduledTime });
  const candidates = await listDayEmailCandidates({ env, now: scheduledTime });
  const dueOwners = candidates.flatMap((candidate) => {
    const day = dueDayOf({ timeZone: candidate.timeZone, minutes: candidate.minutes, now: scheduledTime });
    if (day === null) return [];
    const { language } = candidate;
    if (language !== null) return [{ candidate, day, language }];
    logDayEmailEvent({ event: DayEmailEvent.LanguageUnsupported, ownerId: candidate.owner.ownerId });
    return [];
  });
  const outcomes = await mailDueOwners({
    dueOwners,
    mail: (dueOwner) => mailDueOwner({ scheduledTime, env, dueOwner, sender, publicOrigin }),
  });
  const failed = countOf({ outcomes, outcome: OwnerOutcome.Failed });
  logDayEmailEvent({
    event: DayEmailEvent.Run,
    due: dueOwners.length,
    sent: countOf({ outcomes, outcome: OwnerOutcome.Sent }),
    failed,
  });
  if (failed > 0) throw new Error(failureMessageOf(failed));
}
