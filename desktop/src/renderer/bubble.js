'use strict';
const api=window.desktopPet;
const bubble=document.getElementById('bubble'), text=document.getElementById('bubble-text'), measure=document.getElementById('measure');
let pages=[''], index=0, interactive=false, serial=0, version=-1, phase='hidden';
function hitTest(event) {
  const next=phase==='visible'&&Boolean(document.elementFromPoint(event.clientX,event.clientY)?.closest('button:not(:disabled)'));
  if(next!==interactive){interactive=next;api.bubbleInteractive(next,serial);}
}
function renderPage(navigated=false) {
  text.textContent=pages[index];
  // Measure this page at its natural width, capped at the same text width used
  // for pagination. Short replies therefore do not inherit a full-width card.
  measure.textContent=pages[index];measure.dataset.sizing='content';
  const measuredWidth=measure.getBoundingClientRect().width;
  const padding={thought:36,speech:30,action:20}[bubble.dataset.kind];
  const contentWidth=Math.max(pages.length>1?110:0,Number.isFinite(measuredWidth)?measuredWidth:180-padding);
  bubble.style.width=`${Math.min(180,Math.max(52,Math.ceil(contentWidth+padding)))}px`;
  delete measure.dataset.sizing;
  document.getElementById('pages').hidden=pages.length<=1;
  document.getElementById('previous').disabled=index===0;
  document.getElementById('next').disabled=index===pages.length-1;
  document.getElementById('page-number').textContent=`${index+1} / ${pages.length}`;
  // Include the cloud dots / speech tail in the native window's visible bounds.
  const chrome={thought:34,speech:24,action:16}[bubble.dataset.kind];
  api.resizeBubble(Math.min(190,Math.ceil(bubble.getBoundingClientRect().height+chrome)),serial);
  if(navigated)api.bubblePage({serial,index,total:pages.length,characters:Array.from(pages[index]).length});
}
function render(data) {
  if(!data||!['thought','action','speech'].includes(data.kind)||typeof data.text!=='string'||!Number.isInteger(data.serial)||data.serial<serial)return;
  const nextVersion=Number.isInteger(data.version)?data.version:data.serial;
  if(nextVersion<version)return;
  version=nextVersion;phase=['visible','fading','hidden'].includes(data.phase)?data.phase:'visible';
  document.body.dataset.phase=phase;
  if(phase!=='visible'&&interactive){interactive=false;api.bubbleInteractive(false,data.serial);}
  if (data.serial === serial && pages.length && text.textContent) return;
  serial=data.serial;
  if(phase==='hidden')return;
  index=0; bubble.dataset.kind=data.kind;document.body.dataset.kind=data.kind;measure.dataset.kind=data.kind;
  document.getElementById('dismiss').hidden=data.kind!=='speech';
  const textHeight={thought:85,speech:90,action:75}[data.kind];
  pages=window.BubblePages.paginateText(data.text,candidate=>{measure.textContent=candidate;return measure.getBoundingClientRect().height<=textHeight;});
  renderPage();
}
api.onBubbleCursor(point=>{if(Number.isFinite(point?.x)&&Number.isFinite(point?.y))hitTest({clientX:point.x,clientY:point.y});});
api.onBubble(render); api.bubbleState().then(render);
document.getElementById('previous').addEventListener('click',()=>{if(phase==='visible'&&index>0){index--;renderPage(true);}});
document.getElementById('next').addEventListener('click',()=>{if(phase==='visible'&&index<pages.length-1){index++;renderPage(true);}});
document.getElementById('dismiss').addEventListener('click',()=>api.dismissBubble(serial));
document.addEventListener('mousemove',hitTest);
document.addEventListener('mouseleave',()=>{if(interactive){interactive=false;api.bubbleInteractive(false,serial);}});
