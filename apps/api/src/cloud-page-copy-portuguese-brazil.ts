import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_PORTUGUESE_BRAZIL: CloudPageCopy = {
  fullMail: {
    subject: 'O todz cloud está cheio agora',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `O todz cloud está cheio agora: as vagas gratuitas do todz cloud são extremamente limitadas. Confirme seu endereço para entrar na fila, e você entra quando abrir uma vaga: ${queueUrl}\n\nOu rode o seu próprio servidor, que está sempre aberto: ${selfHostUrl}`,
  },
  queuePage: {
    title: 'Entre na fila do todz cloud',
    lead: 'As vagas gratuitas do todz cloud são extremamente limitadas. Confirme abaixo e escreveremos quando uma abrir.',
    joinAs: 'Entrar na fila como',
    invalidTitle: 'Este link não é mais válido',
    invalidBody:
      'O link do e-mail que enviamos quando o todz cloud estava cheio vale por uma semana. Peça um novo link de acesso no app para receber outro.',
    submit: 'Entrar na fila',
    submitting: 'Enviando…',
    queuedTitle: 'Você está na lista',
    queuedBody: 'Enviaremos um e-mail quando uma vaga abrir.',
    tryAgain: 'Não foi possível adicionar você agora. Tente de novo em um minuto.',
    closed: 'A fila está fechada agora.',
    forbidden: 'Esse pedido não veio deste site.',
    selfHost: 'Ou rode o seu próprio servidor, que está sempre aberto:',
    selfHostLink: 'guia de auto-hospedagem',
  },
};
