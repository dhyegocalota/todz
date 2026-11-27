import type { DayEmailStopCopy } from './day-email-stop-copy';
export const DAY_EMAIL_STOP_COPY_JAPANESE: DayEmailStopCopy = {
  confirm: {
    heading: '1日のメールを停止しますか？',
    sentence: 'todzは、このアドレスへの1日のメールの送信を停止します。',
    button: '1日のメールを停止',
  },
  done: {
    heading: '1日のメールはオフです',
    sentence: 'todzの設定で、もう一度オンにできます。',
  },
  gone: {
    heading: 'このリンクは、もう使えません',
    sentence: '1日のメールは、todzの設定で変更できます。',
  },
  limited: {
    heading: '1分後にもう一度お試しください',
    sentence: 'ここからの試行回数が多すぎます。',
  },
};
