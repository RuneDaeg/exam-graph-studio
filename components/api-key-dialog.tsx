'use client';
import {useRef,useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export function ApiKeyDialog({connected,onConnect,onDisconnect,onClose}:{connected:boolean;onConnect:(key:string)=>void;onDisconnect:()=>void;onClose:()=>void}){
 const input=useRef<HTMLInputElement>(null);
 const [error,setError]=useState('');
 function clear(){if(input.current)input.current.value='';}
 function close(){clear();onClose();}
 function connect(){
  const key=input.current?.value.trim()||'';
  if(!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)){setError('OpenAI API 키 형식을 확인해 주세요.');return;}
  onConnect(key);clear();onClose();
 }
 return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent><DialogHeader><DialogTitle>내 API로 그래프 만들기</DialogTitle><DialogDescription>본인의 OpenAI API 키를 연결하세요. 생성 비용은 본인 OpenAI 계정에 청구됩니다. ChatGPT 구독과는 별도입니다.</DialogDescription></DialogHeader>
  <div className="api-privacy"><b>현재 탭에서만 사용합니다</b><ul><li>키는 브라우저 메모리에만 보관하고 서버나 기기에 저장하지 않습니다.</li><li>설명·이미지와 API 키는 OpenAI로 직접 전송됩니다.</li><li>새로고침하거나 연결을 해제하면 키가 지워집니다.</li></ul></div>
  <label className="field-label" htmlFor="personal-api-key">OpenAI API 키<input ref={input} id="personal-api-key" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={512} placeholder="sk-…" onKeyDown={e=>{if(e.key==='Enter')connect();}}/></label>
  {error&&<p className="error" role="alert">{error}</p>}
  <p className="hint">브라우저 확장 프로그램 등은 입력한 키에 접근할 수 있습니다. 신뢰하는 개인 기기에서 사용하고, 이 앱 전용 키를 권장합니다.</p>
  <div className="api-links"><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">API 키 관리 ↗</a><span>모델 · gpt-5.4-mini</span></div>
  <div className="dialog-actions">{connected&&<button className="button" onClick={()=>{clear();onDisconnect();onClose();}}>연결 해제</button>}<button className="button" onClick={close}>취소</button><button className="button primary" onClick={connect}>{connected?'키 바꾸기':'이 탭에서 사용'}</button></div>
 </DialogContent></Dialog>;
}
