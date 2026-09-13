const {test} = require('node:test');
const assert = require('node:assert/strict');
require('../dynamic-score.js');
const score = global.DynamicScore;
test('does not inflate coverage with partial words', () => {
  const result = score.calculateDynamicMatch('JavaScript and repair planning', ['Java', 'AI', 'JavaScript']);
  assert.deepEqual(result.matched, ['JavaScript']);
  assert.equal(result.score, 33);
});
test('matches punctuated skills and wrapped phrases', () => {
  const result = score.calculateDynamicMatch('C++, C# and .NET; machine\nlearning', ['C++', 'C#', '.NET', 'machine learning']);
  assert.equal(result.score, 100);
});
test('deduplicates and ignores invalid keyword entries', () => {
  const result = score.calculateDynamicMatch('Python', ['Python', 'python', '', null, 42, 'SQL']);
  assert.equal(result.totalKeywords, 2);
  assert.equal(result.score, 50);
});
test('frequency agrees with coverage for technical skills', () => {
  assert.deepEqual(score.getKeywordFrequency('C++ and C++; JavaScript', ['C++', 'Java']), {'C++': 2, Java: 0});
});
test('missing input produces no fabricated score', () => {
  assert.equal(score.calculateDynamicMatch('', ['Python']).score, 0);
});
