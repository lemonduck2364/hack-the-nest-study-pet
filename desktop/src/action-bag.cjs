'use strict';
function createActionBag(items, random = Math.random) {
  if (!Array.isArray(items) || !items.length || new Set(items).size !== items.length) throw new Error('Actions must be nonempty and unique');
  let bag = [], previous;
  const choose = size => Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * size);
  return {
    next() {
      if (!bag.length) {
        bag = items.slice();
        for (let i = bag.length - 1; i > 0; i--) { const j = choose(i + 1); [bag[i], bag[j]] = [bag[j], bag[i]]; }
        if (bag.length > 1 && bag.at(-1) === previous) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
      previous = bag.pop(); return previous;
    }
  };
}
module.exports = { createActionBag };
