'use strict';
(function(root) {
  function paginateText(text, fits) {
    const chars=Array.from(text); const pages=[]; let start=0;
    while(start<chars.length) {
      let low=1, high=Math.min(500,chars.length-start), best=1;
      while(low<=high) {
        const mid=Math.floor((low+high)/2);
        if(fits(chars.slice(start,start+mid).join(''))) {best=mid;low=mid+1;} else high=mid-1;
      }
      let end=start+best;
      if(end<chars.length) {
        for(let i=end-1;i>Math.max(start,end-28);i--) if(/\s/.test(chars[i])) {end=i+1;break;}
      }
      pages.push(chars.slice(start,end).join('')); start=end;
    }
    return pages.length?pages:[''];
  }
  const api={paginateText};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BubblePages=api;
})(globalThis);
