// Vercel Serverless Function 入口
import { handleRequest } from './routes';

export default async function handler(request: Request): Promise<Response> {
  return handleRequest(request);
}

export const config = {
  runtime: 'edge',
};
