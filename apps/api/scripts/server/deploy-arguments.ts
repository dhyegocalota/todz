const DEPLOY_COMMAND = 'deploy';
const DEFINE_FLAG = '--define';
const SERVER_VERSION_DEFINE = 'TODZ_SERVER_VERSION';

export function deployArguments({ serverVersion, extraArguments }: { serverVersion: string; extraArguments: string[] }): string[] {
  return [DEPLOY_COMMAND, DEFINE_FLAG, `${SERVER_VERSION_DEFINE}:"${serverVersion}"`, ...extraArguments];
}
