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
  function paginateSpeech(text, fits) {
    if (!text || fits(text)) return [text];
    const segment = granularity => [...new Intl.Segmenter(undefined, { granularity }).segment(text)];
    const ends = segments => new Set(segments.map(({ index, segment }) => index + segment.length));
    const graphemes = segment('grapheme');
    const sentenceEnds = ends(segment('sentence'));
    const wordEnds = ends(segment('word'));
    const pages = [];
    const offset = index => graphemes[index]?.index ?? text.length;
    let start = 0;
    while (start < graphemes.length) {
      let low = start + 1;
      let high = Math.min(start + 500, graphemes.length);
      let end = low;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (fits(text.slice(offset(start), offset(middle)))) {
          end = middle;
          low = middle + 1;
        } else high = middle - 1;
      }
      if (end < graphemes.length) {
        // Leave room for a natural breath without producing a string of tiny pages.
        const preferred = Math.max(start + 1, start + Math.floor((end - start) / 2));
        let boundary;
        let priority = 0;
        for (let candidate = end; candidate >= preferred; candidate--) {
          const before = text.slice(offset(start), offset(candidate)).replace(/[^\S\n]+$/u, '');
          const after = graphemes[candidate].segment;
          const sentence = sentenceEnds.has(offset(candidate)) || /[。！？!?…\n]$/u.test(before);
          const phrase = /[,;:，、；：—]$/u.test(before);
          const word = wordEnds.has(offset(candidate));
          const closesPhrase = /^[\p{Pe}\p{Pf}.,!?、。，！？；：]/u.test(after);
          const score = closesPhrase ? 0 : sentence ? 3 : phrase ? 2 : word ? 1 : 0;
          if (score > priority) {
            boundary = candidate;
            priority = score;
          }
          if (priority === 3) break;
        }
        end = boundary ?? end;
      }
      pages.push(text.slice(offset(start), offset(end)));
      start = end;
    }
    return pages;
  }
  const api={paginateText,paginateSpeech};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BubblePages=api;
})(globalThis);
