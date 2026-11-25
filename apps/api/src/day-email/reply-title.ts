export enum TitleOutcome {
  Titled = 'titled',
  Empty = 'empty',
  InvalidTitle = 'invalid_title',
}

export type ReplyTitle = { outcome: TitleOutcome.Titled; title: string } | { outcome: Exclude<TitleOutcome, TitleOutcome.Titled> };

export function replyTitleOf(text: string | undefined): ReplyTitle {
  throw new Error('replyTitleOf is not implemented');
}
