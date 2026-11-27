import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_KOREAN: CloudPageCopy = {
  fullMail: {
    subject: 'todz cloud가 지금은 가득 찼어요',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `todz cloud가 지금은 가득 찼어요. 무료 todz cloud 자리는 매우 한정되어 있어요. 주소를 확인하고 대기열에 서면 자리가 날 때 들어올 수 있어요: ${queueUrl}\n\n아니면 언제나 열려 있는 나만의 서버를 운영하세요: ${selfHostUrl}`,
  },
  queuePage: {
    title: 'todz cloud 대기열에 서기',
    lead: '무료 todz cloud 자리는 매우 한정되어 있어요. 아래에서 확인하면 자리가 날 때 메일로 알려 드려요.',
    joinAs: '대기열에 참여할 주소',
    invalidTitle: '이 링크는 더 이상 유효하지 않아요',
    invalidBody:
      'todz cloud가 가득 찼을 때 보낸 메일의 링크는 일주일 동안 유효해요. 앱에서 새 로그인 링크를 요청하면 새 링크를 받을 수 있어요.',
    submit: '대기열에 서기',
    submitting: '보내는 중…',
    queuedTitle: '대기 목록에 올랐어요',
    queuedBody: '자리가 나면 이메일로 알려 드릴게요.',
    tryAgain: '지금은 추가할 수 없어요. 잠시 뒤에 다시 시도해 주세요.',
    closed: '지금은 대기열이 닫혀 있어요.',
    forbidden: '그 요청은 이 사이트에서 오지 않았어요.',
    selfHost: '아니면 언제나 열려 있는 나만의 서버를 운영하세요:',
    selfHostLink: '셀프 호스팅 가이드',
  },
};
