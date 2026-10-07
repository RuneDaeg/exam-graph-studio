'use client';
import {useState} from 'react';

export function StudioFooter(){
 const [showEmail,setShowEmail]=useState(false);
 return <footer className="footer">
  <span className="footer-brand">도해 <span className="footer-dot">/</span> EXAM GRAPH STUDIO</span>
  <div className="footer-credits">
   <div className="footer-credit-line">made by <button type="button" className="creator-name" aria-expanded={showEmail} aria-controls="creator-contact" title={showEmail?'이메일 주소 숨기기':'이메일 주소 보기'} onClick={()=>setShowEmail(value=>!value)}>여광재(온양고)</button> <span>@Rune</span></div>
   <div className="footer-credit-line">made with <a href="https://dorms.school" target="_blank" rel="noopener noreferrer">DoRms</a></div>
   <div id="creator-contact" className="footer-contact" hidden={!showEmail}><a href="mailto:rune_daeg@naver.com">rune_daeg@naver.com</a></div>
  </div>
 </footer>;
}
