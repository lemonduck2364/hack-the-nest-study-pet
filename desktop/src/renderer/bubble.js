'use strict';
const api=window.desktopPet;
const bubble=document.getElementById('bubble'), text=document.getElementById('bubble-text'), measure=document.getElementById('measure');
let pages=[''], index=0, interactive=false, serial=0;
function hitTest(event) {
  const next=Boolean(document.elementFromPoint(event.clientX,event.clientY)?.closest('button:not(:disabled)'));
  if(next!==interactive){interactive=next;api.bubbleInteractive(next);}
}
function renderPage() {
  text.textContent=pages[index];
  document.getElementById('pages').hidden=pages.length<=1;
  document.getElementById('previous').disabled=index===0;
  document.getElementById('next').disabled=index===pages.length-1;
  document.getElementById('page-number').textContent=`${index+1} / ${pages.length}`;
  api.resizeBubble(Math.min(230,Math.ceil(bubble.getBoundingClientRect().height+35)),serial);
}
function render(data) {
  if(!data||!['thought','action','speech'].includes(data.kind)||typeof data.text!=='string'||!Number.isInteger(data.serial)||data.serial<serial)return;
  if (data.serial === serial && pages.length && text.textContent) { document.body.dataset.side=data.side||'left'; return; }
  serial=data.serial; index=0; bubble.dataset.kind=data.kind; document.body.dataset.side=data.side||'left';
  document.getElementById('dismiss').hidden=data.kind!=='speech'||!data.persistent;
  if(data.kind==='speech')pages=window.BubblePages.paginateText(data.text,candidate=>{measure.textContent=candidate;return measure.getBoundingClientRect().height<=140;});
  else pages=[data.text];
  renderPage();
}
api.onBubbleCursor(point=>{if(Number.isFinite(point?.x)&&Number.isFinite(point?.y))hitTest({clientX:point.x,clientY:point.y});});
api.onBubbleSide(side=>{document.body.dataset.side=side;});
api.onBubble(render); api.bubbleState().then(render);
document.getElementById('previous').addEventListener('click',()=>{if(index>0){index--;renderPage();}});
document.getElementById('next').addEventListener('click',()=>{if(index<pages.length-1){index++;renderPage();}});
document.getElementById('dismiss').addEventListener('click',()=>api.dismissBubble());
document.addEventListener('mousemove',hitTest);
document.addEventListener('mouseleave',()=>{if(interactive){interactive=false;api.bubbleInteractive(false);}});
