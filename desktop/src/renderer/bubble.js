'use strict';
const api=window.desktopPet;
const bubble=document.getElementById('bubble'), text=document.getElementById('bubble-text'), measure=document.getElementById('measure');
const navigation = document.getElementById('pages');
const previous = document.getElementById('previous'), next = document.getElementById('next'), pause = document.getElementById('pause');
let pages=[''], index=0, interactive=false, serial=0, version=-1, phase='hidden', subtitles=false, paused=false;
function hitTest(event) {
  const next=phase==='visible'&&Boolean(document.elementFromPoint(event.clientX,event.clientY)?.closest('button:not(:disabled)'));
  if(next!==interactive){interactive=next;api.bubbleInteractive(next,serial);}
}
function renderPage() {
  text.textContent=pages[index];
  // Measure this page at its natural width, capped at the same text width used
  // for pagination. Short replies therefore do not inherit a full-width card.
  measure.textContent=pages[index];measure.dataset.sizing='content';
  const measuredWidth=measure.getBoundingClientRect().width;
  const padding={thought:36,speech:30,action:20}[bubble.dataset.kind];
  const minWidth = subtitles ? 150 : pages.length > 1 ? 110 : 0;
  const contentWidth=Math.max(minWidth,Number.isFinite(measuredWidth)?measuredWidth:180-padding);
  bubble.style.width=`${Math.min(180,Math.max(52,Math.ceil(contentWidth+padding)))}px`;
  delete measure.dataset.sizing;
  navigation.hidden=pages.length<=1;
  previous.disabled=index===0;
  next.disabled=index===pages.length-1;
  pause.hidden=!subtitles;
  if (subtitles) {
    pause.textContent = paused ? '▶' : 'Ⅱ';
    pause.setAttribute('aria-label', paused ? 'Resume reply' : 'Pause reply');
  }
  document.getElementById('page-number').textContent=`${index+1} / ${pages.length}`;
  // Include the cloud dots / speech tail in the native window's visible bounds.
  const chrome={thought:34,speech:24,action:16}[bubble.dataset.kind];
  api.resizeBubble(Math.min(190,Math.ceil(bubble.getBoundingClientRect().height+chrome)),serial);
}
function render(data) {
  if(!data||!['thought','action','speech'].includes(data.kind)||typeof data.text!=='string'||!Number.isInteger(data.serial)||data.serial<serial)return;
  const nextVersion=Number.isInteger(data.version)?data.version:data.serial;
  if(nextVersion<version)return;
  version=nextVersion;phase=['visible','fading','hidden'].includes(data.phase)?data.phase:'visible';
  document.body.dataset.phase=phase;
  const isNew = data.serial !== serial;
  if((isNew||phase!=='visible')&&interactive){interactive=false;api.bubbleInteractive(false,data.serial);}
  serial=data.serial;
  if(phase==='hidden')return;
  if (!isNew) {
    if (!subtitles || phase !== 'visible' || !Number.isInteger(data.pageIndex)
      || data.pageIndex < 0 || data.pageIndex >= pages.length) return;
    const nextPaused = data.paused === true;
    if (data.pageIndex === index && nextPaused === paused) return;
    index = data.pageIndex;
    paused = nextPaused;
    renderPage();
    return;
  }
  bubble.dataset.kind=data.kind;document.body.dataset.kind=data.kind;measure.dataset.kind=data.kind;
  document.getElementById('dismiss').hidden=data.kind!=='speech';
  const reply = data.kind === 'speech' && data.persistent;
  const textHeight = reply ? 36 : {thought:85,speech:90,action:75}[data.kind];
  const paginate = window.BubblePages[reply ? 'paginateSpeech' : 'paginateText'];
  pages=paginate(data.text,candidate=>{measure.textContent=candidate;return measure.getBoundingClientRect().height<=textHeight;});
  index = Number.isInteger(data.pageIndex) && data.pageIndex >= 0 && data.pageIndex < pages.length ? data.pageIndex : 0;
  paused = data.paused === true;
  subtitles = reply && pages.length > 1;
  bubble.dataset.subtitles = String(Boolean(subtitles));
  renderPage();
  if (subtitles && phase === 'visible' && !Number.isInteger(data.pageIndex)) {
    api.bubblePage({ serial, pageLengths: pages.map(part => Array.from(part).length) });
  }
}
function turnPage(indexToShow) {
  if (phase !== 'visible' || indexToShow < 0 || indexToShow >= pages.length) return;
  if (subtitles) api.bubblePage({ serial, index: indexToShow });
  else { index = indexToShow; renderPage(); }
}
api.onBubbleCursor(point=>{if(Number.isFinite(point?.x)&&Number.isFinite(point?.y))hitTest({clientX:point.x,clientY:point.y});});
api.onBubble(render); api.bubbleState().then(render);
previous.addEventListener('click', () => turnPage(index - 1));
next.addEventListener('click', () => turnPage(index + 1));
pause.addEventListener('click', () => { if (subtitles && phase === 'visible') api.bubblePage({ serial, togglePause: true }); });
document.getElementById('dismiss').addEventListener('click',()=>api.dismissBubble(serial));
document.addEventListener('mousemove',hitTest);
document.addEventListener('mouseleave',()=>{if(interactive){interactive=false;api.bubbleInteractive(false,serial);}});
