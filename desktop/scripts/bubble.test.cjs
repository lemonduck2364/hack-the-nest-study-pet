'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {paginateText}=require('../src/renderer/bubble-pages.js');
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

test('late initial bubble snapshot cannot overwrite a newer reply',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const elements=new Map();
  const el=()=>({textContent:'',hidden:false,dataset:{},style:{},events:{},addEventListener(name,fn){this.events[name]=fn;},getBoundingClientRect(){return{height:Math.max(20,Math.ceil(Array.from(this.textContent).length/30)*20)};}});
  const document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},addEventListener(){}};
  let publish,resolveOld,lastSized;
  const initial=new Promise(resolve=>{resolveOld=resolve;});
  const api={onBubble(fn){publish=fn;},onBubbleSide(){},onBubbleCursor(){},bubbleState(){return initial;},resizeBubble(_height,serial){lastSized=serial;},bubbleInteractive(){},dismissBubble(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/bubble.js'),'utf8'),{window:{desktopPet:api,BubblePages:{paginateText}},document});
  publish({kind:'speech',text:'new reply',serial:2,persistent:true});
  resolveOld({kind:'thought',text:'old thought',serial:1});
  await new Promise(setImmediate);
  assert.equal(elements.get('bubble-text').textContent,'new reply');assert.equal(lastSized,2);
});
test('late same-content snapshot cannot undo a newer fade phase',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const elements=new Map();
  const el=()=>({textContent:'',hidden:false,dataset:{},style:{},events:{},addEventListener(name,fn){this.events[name]=fn;},getBoundingClientRect(){return{height:20};}});
  const document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},addEventListener(){}};
  let publish,resolveOld;
  const initial=new Promise(resolve=>{resolveOld=resolve;});
  const api={onBubble(fn){publish=fn;},onBubbleSide(){},onBubbleCursor(){},bubbleState(){return initial;},resizeBubble(){},bubbleInteractive(){},dismissBubble(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/bubble.js'),'utf8'),{window:{desktopPet:api,BubblePages:{paginateText}},document});
  publish({kind:'speech',text:'reply',serial:2,version:3,phase:'visible'});
  publish({kind:'speech',text:'reply',serial:2,version:4,phase:'fading'});
  resolveOld({kind:'speech',text:'reply',serial:2,version:3,phase:'visible'});
  await new Promise(setImmediate);
  assert.equal(document.body.dataset.phase,'fading');
});

test('compact bubbles paginate without losing text and keep manual pages across phase updates',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const elements=new Map(),sizes=[],turns=[];
  // A deterministic layout stand-in: narrow columns and the renderer's three line heights.
  const lineHeight={speech:18,thought:17,action:15};
  const textHeight=(value,kind)=>Math.max(1,Math.ceil(Array.from(value).length/12))*lineHeight[kind];
  const document={body:{dataset:{}},getElementById(id){
    if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,dataset:{},style:{},events:{},addEventListener(name,fn){this.events[name]=fn;},getBoundingClientRect(){
      if(id==='measure')return{height:textHeight(this.textContent,this.dataset.kind),width:Math.min({speech:150,thought:144,action:160}[this.dataset.kind],Array.from(this.textContent).length*6)};
      if(id==='bubble')return{height:textHeight(elements.get('bubble-text').textContent,this.dataset.kind)+30+(elements.get('pages').hidden?0:23)};
      return{height:18};
    }});
    return elements.get(id);
  },addEventListener(){}};
  let publish;
  const api={onBubble(fn){publish=fn;},onBubbleCursor(){},bubbleState(){return new Promise(()=>{});},resizeBubble(height,serial){sizes.push({height,serial});},bubbleInteractive(){},dismissBubble(){},bubblePage(page){turns.push(page);}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/bubble.js'),'utf8'),{window:{desktopPet:api,BubblePages:{paginateText}},document});
  let serial=0;
  for(const kind of ['speech','thought','action']){
    publish({kind,text:'oh, hello!',serial:++serial,version:serial*10,phase:'visible'});
    const shortWidth=parseInt(elements.get('bubble').style.width);
    assert.ok(shortWidth>=52&&shortWidth<180,'short text must shrink its visible shape');
    assert.equal(elements.get('measure').dataset.sizing,undefined,'natural-width measuring must not leak into later pagination');
    const original=('慢慢看，沒有要趕你。🌊\n').repeat(30);
    publish({kind,text:original,serial:++serial,version:serial*10,phase:'visible'});
    assert.equal(elements.get('bubble').style.width,'180px','long pages may use the full bounded width');
    let reconstructed='';
    const maxHeight={speech:90,thought:85,action:75}[kind];
    do{
      const page=elements.get('bubble-text').textContent;
      assert.ok(textHeight(page,kind)<=maxHeight);
      reconstructed+=page;
      if(elements.get('next').disabled)break;
      elements.get('next').events.click();
    }while(true);
    assert.equal(reconstructed,original);
    const lastPage=elements.get('bubble-text').textContent;
    publish({kind,text:original,serial,version:serial*10+1,phase:'fading'});
    assert.equal(elements.get('bubble-text').textContent,lastPage);
    const count=turns.length;
    elements.get('previous').events.click();
    assert.equal(turns.length,count,'fading bubbles cannot navigate or extend their lifetime');
  }
  assert.ok(turns.length>0);
  assert.ok(sizes.every(({height})=>height<=190));
  assert.ok(turns.every(page=>page.index>=1&&page.index<page.total&&page.characters>0));
});
