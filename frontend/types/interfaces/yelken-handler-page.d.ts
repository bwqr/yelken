export namespace YelkenHandlerPage {
  export function load(req: Request): Response;
}
export interface Request {
  url: string,
  query: string,
}
export interface Response {
  head: Array<string>,
  body: string,
  scripts: Array<string>,
}
