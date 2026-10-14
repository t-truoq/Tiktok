// truonglt render runtime binding start
export function listenHost(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.HOST || (environment.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
}
// truonglt render runtime binding end
