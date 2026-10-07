import {hasApiKey} from '@/lib/server-key';
export function GET(){return Response.json({ready:hasApiKey()},{headers:{'Cache-Control':'no-store'}});}
