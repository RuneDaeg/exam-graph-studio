import { env } from 'cloudflare:workers';
const runtime = () => env as unknown as Record<string,string|undefined>;
export function hasApiKey(){const e=runtime();return Boolean(e.OPENAI_API_KEY||process.env.OPENAI_API_KEY||(e.OPENAI_KEY_CIPHERTEXT&&e.OPENAI_KEY_PRIVATE_JWK));}
// The hosted key is provisioned as an encrypted secret; plaintext is never logged.
export async function getApiKey(){
 const e=runtime();const direct=e.OPENAI_API_KEY||process.env.OPENAI_API_KEY;
 if(direct)return direct;
 if(!e.OPENAI_KEY_CIPHERTEXT||!e.OPENAI_KEY_PRIVATE_JWK)return null;
 const jwk=JSON.parse(e.OPENAI_KEY_PRIVATE_JWK);
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
 const raw=Uint8Array.from(atob(e.OPENAI_KEY_CIPHERTEXT.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'RSA-OAEP'},key,raw));
}
export function getModel(){return runtime().OPENAI_MODEL||'gpt-5.4-mini';}
