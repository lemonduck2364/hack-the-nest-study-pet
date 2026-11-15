'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const BubblePages=require('../src/renderer/bubble-pages.js');
const {paginateText,paginateSpeech}=BubblePages;
test('long Chinese, emoji, whitespace and words survive pagination exactly',()=>{
  for(const original of ['你好 🌊 '+('今天想做什麼呢？🙂\n'.repeat(80)),'word '.repeat(600),'x'.repeat(4000),'\n\n a\t b  \n end']){
    const pages=paginateText(original,text=>Array.from(text).length<=90);
    assert.equal(pages.join(''),original);
    assert.ok(pages.every(page=>Array.from(page).length<=90));
    assert.ok(pages.every(page=>!/[\uD800-\uDBFF]$/.test(page)&&!/[\uDC00-\uDFFF]/.test(page[0]||'')));
  }
});
test('page boundary backs up to whitespace without discarding it',()=>{
  const original='one two three four five six seven eight nine';
  const pages=paginateText(original,text=>text.length<=17);
  assert.equal(pages.join(''),original);assert.ok(pages[0].endsWith(' '));
});
test('subtitles prefer complete phrases and preserve mixed-language graphemes exactly', () => {
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const fits = limit => text => [...graphemes.segment(text)].length <= limit;
  const english = 'Hi there! I made some tea, and saved a cup for you.';
  const chinese = '我來泡茶了。今天想坐在窗邊，陪你慢慢喝。';
  assert.equal(paginateSpeech(english, fits(16))[0], 'Hi there! ');
  assert.equal(paginateSpeech(chinese, fits(12))[0], '我來泡茶了。');
  for (const original of [english, chinese, 'e\u0301👩🏽‍💻🇹🇼家族👨‍👩‍👦\n  '.repeat(25), 'x'.repeat(4000)]) {
    const parts = paginateSpeech(original, fits(12));
    assert.equal(parts.join(''), original);
    assert.ok(parts.every(fits(12)));
    const boundaries = new Set([...graphemes.segment(original)].map(({ index }) => index));
    let offset = 0;
    for (const part of parts) { assert.ok(boundaries.has(offset)); offset += part.length; }
  }
});

test('late initial bubble snapshot cannot overwrite a newer reply',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const elements=new Map();
  const el=()=>({textContent:'',hidden:false,dataset:{},style:{},events:{},addEventListener(name,fn){this.events[name]=fn;},getBoundingClientRect(){return{height:20,width:this.textContent.length*6};}});
  const document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},addEventListener(){}};
  let publish,resolveOld,lastSized;
  const initial=new Promise(resolve=>{resolveOld=resolve;});
  const api={onBubble(fn){publish=fn;},onBubbleSide(){},onBubbleCursor(){},bubbleState(){return initial;},resizeBubble(_height,serial){lastSized=serial;},bubbleInteractive(){},dismissBubble(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/bubble.js'),'utf8'),{window:{desktopPet:api,BubblePages},document});
  publish({kind:'speech',text:'new reply',serial:2,persistent:true});
  resolveOld({kind:'thought',text:'old thought',serial:1});
  await new Promise(setImmediate);
  assert.equal(elements.get('bubble-text').textContent,'new reply');assert.equal(lastSized,2);
});
test('late same-content snapshot cannot undo a newer fade phase',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const elements=new Map();
  const el=()=>({textContent:'',hidden:false,dataset:{},style:{},events:{},addEventListener(name,fn){this.events[name]=fn;},getBoundingClientRect(){return{height:20,width:this.textContent.length*6};}});
  const document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},addEventListener(){}};
  let publish,resolveOld;
  const initial=new Promise(resolve=>{resolveOld=resolve;});
  const api={onBubble(fn){publish=fn;},onBubbleSide(){},onBubbleCursor(){},bubbleState(){return initial;},resizeBubble(){},bubbleInteractive(){},dismissBubble(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/bubble.js'),'utf8'),{window:{desktopPet:api,BubblePages},document});
  publish({kind:'speech',text:'reply',serial:2,version:3,phase:'visible'});
  publish({kind:'speech',text:'reply',serial:2,version:4,phase:'fading'});
  resolveOld({kind:'speech',text:'reply',serial:2,version:3,phase:'visible'});
  await new Promise(setImmediate);
  assert.equal(document.body.dataset.phase,'fading');
});

test('speech advances in a content-fit single line without page controls and captions retain their layout',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const elements=new Map(),sizes=[],turns=[];
  // The width stand-in leaves speech unwrapped, matching the real measurement node.
  const textHeight=(value,kind)=>Math.max(1,Math.ceil(Array.from(value).length/12))*{thought:17,action:15}[kind];
  const speechWidth=value=>Array.from(value.trim()).length*6;
  const document={body:{dataset:{}},getElementById(id){
    if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,dataset:{},style:{},events:{},setAttribute(){},addEventListener(name,fn){this.events[name]=fn;},getBoundingClientRect(){
      if(id==='measure'&&this.dataset.kind==='speech')return{height:18,width:speechWidth(this.textContent)};
      if(id==='measure')return{height:textHeight(this.textContent,this.dataset.kind),width:Math.min({thought:144,action:160}[this.dataset.kind],Array.from(this.textContent).length*6)};
      if(id==='bubble')return{height:this.dataset.kind==='speech'?30:textHeight(elements.get('bubble-text').textContent,this.dataset.kind)+30+(elements.get('pages').hidden?0:23)};
      return{height:18};
    }});
    return elements.get(id);
  },addEventListener(){}};
  let publish, state;
  const api={onBubble(fn){publish=next=>{state=next;fn(next);};},onBubbleCursor(){},bubbleState(){return new Promise(()=>{});},resizeBubble(height,serial){sizes.push({height,serial});},bubbleInteractive(){},dismissBubble(){},bubblePage(page){
    turns.push(page);
    publish({ ...state, version: state.version+1, pageIndex: 0 });
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/bubble.js'),'utf8'),{window:{desktopPet:api,BubblePages},document});
  let serial=0;
  for(const kind of ['speech','thought','action']){
    publish({kind,text:'oh, hello!',serial:++serial,version:serial*100,phase:'visible'});
    const shortWidth=parseInt(elements.get('bubble').style.width);
    assert.ok(shortWidth>=52&&shortWidth<180,'short text must shrink its visible shape');
    assert.equal(elements.get('measure').dataset.sizing,undefined,'natural-width measuring must not leak into later pagination');
    const original=('慢慢看，沒有要趕你。🌊\n').repeat(30);
    publish({kind,text:original,serial:++serial,version:serial*100,phase:'visible',persistent:kind==='speech'});
    let reconstructed='';
    if (kind === 'speech') {
      assert.equal(elements.get('pages').hidden, true);
      assert.equal(elements.get('page-number').textContent, '');
      for (const [pageIndex, length] of turns[0].pageLengths.entries()) {
        publish({ ...state, version: state.version+1, pageIndex });
        const line = elements.get('bubble-text').textContent;
        const width = speechWidth(line);
        assert.ok(width <= 147);
        assert.equal(Array.from(line).length, length);
        assert.equal(elements.get('bubble').style.width, Math.max(52, width + 33) + 'px');
        assert.equal(sizes.at(-1).height, 54);
        reconstructed += line;
      }
    } else {
      assert.equal(elements.get('bubble').style.width,'180px');
      do{
        const page=elements.get('bubble-text').textContent;
        assert.ok(textHeight(page,kind)<=(kind==='thought'?85:75));
        reconstructed+=page;
        if(elements.get('next').disabled)break;
        elements.get('next').events.click();
      }while(true);
    }
    assert.equal(reconstructed,original);
    const lastPage=elements.get('bubble-text').textContent;
    publish({...state,version:state.version+1,phase:'fading'});
    assert.equal(elements.get('bubble-text').textContent,lastPage);
    const count=turns.length;
    elements.get('previous').events.click();
    assert.equal(turns.length,count,'fading bubbles cannot navigate or extend their lifetime');
  }
  assert.ok(turns.length>0);
  assert.ok(sizes.every(({height})=>height<=190));
  assert.ok(turns[0].pageLengths.length > 1);
  assert.ok(turns[0].pageLengths.every(length => length > 0));
});
