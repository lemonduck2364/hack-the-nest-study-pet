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
  const el=()=>({textContent:'',hidden:false,dataset:{},events:{},addEventListener(name,fn){this.events[name]=fn;},getBoundingClientRect(){return{height:Math.max(20,Math.ceil(Array.from(this.textContent).length/30)*20)};}});
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
