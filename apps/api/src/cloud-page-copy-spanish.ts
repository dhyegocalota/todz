import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_SPANISH: CloudPageCopy = {
  fullMail: {
    subject: 'todz cloud está lleno en este momento',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `todz cloud está lleno en este momento: los cupos gratuitos de todz cloud son extremadamente limitados. Confirma tu dirección para unirte a la lista de espera y entrarás cuando se abra un cupo: ${queueUrl}\n\nO ejecuta tu propio servidor, que siempre está abierto: ${selfHostUrl}`,
  },
  queuePage: {
    title: 'Únete a la lista de espera de todz cloud',
    lead: 'Los cupos gratuitos de todz cloud son extremadamente limitados. Confirma abajo y te escribiremos cuando se abra uno.',
    joinAs: 'Unirte a la lista como',
    invalidTitle: 'Este enlace ya no es válido',
    invalidBody:
      'El enlace del correo que enviamos cuando todz cloud estaba lleno funciona durante una semana. Pide un nuevo enlace de inicio de sesión en la app para obtener uno nuevo.',
    submit: 'Unirme a la lista',
    submitting: 'Enviando…',
    queuedTitle: 'Estás en la lista',
    queuedBody: 'Te escribiremos por correo cuando se abra un cupo.',
    tryAgain: 'No se pudo añadirte en este momento. Vuelve a intentarlo en un minuto.',
    closed: 'La lista está cerrada en este momento.',
    forbidden: 'Esa solicitud no vino de este sitio.',
    selfHost: 'O ejecuta tu propio servidor, que siempre está abierto:',
    selfHostLink: 'guía de autoalojamiento',
  },
};
