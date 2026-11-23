export { ProjectStore } from './project-store';

const NOT_FOUND_STATUS = 404;

export default {
  fetch(): Response {
    return new Response(null, { status: NOT_FOUND_STATUS });
  },
} satisfies ExportedHandler;
