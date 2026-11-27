export enum HttpMethod {
  Get = 'GET',
  Head = 'HEAD',
  Post = 'POST',
  Patch = 'PATCH',
  Delete = 'DELETE',
}

export const READ_METHODS: string[] = [HttpMethod.Get, HttpMethod.Head];
