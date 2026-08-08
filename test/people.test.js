const test = require('node:test');
const assert = require('node:assert/strict');
const { tokenPathFromEnv } = require('../src/auth');
const { compactContact, matchesQuery, personBody, requireConfirmation } = require('../src/people');

test('token path is opt-in and never defaults to a credential location', () => {
  assert.throws(() => tokenPathFromEnv({}), /GOOGLE_CONTACTS_TOKEN_PATH/);
  assert.equal(tokenPathFromEnv({ GOOGLE_CONTACTS_TOKEN_PATH: '/tmp/token.json' }), '/tmp/token.json');
});

test('search normalizes accents and requires all words', () => {
  const person = { resourceName: 'people/c1', names: [{ displayName: 'Inês Ferreira Souza' }], emailAddresses: [{ value: 'ines@example.com' }] };
  assert.equal(matchesQuery(person, 'ines souza'), true);
  assert.equal(matchesQuery(person, 'ines lima'), false);
});

test('contact summaries do not include raw People API metadata', () => {
  const result = compactContact({ resourceName: 'people/c1', etag: 'abc', names: [{ displayName: 'Ana' }], emailAddresses: [{ value: 'ana@example.com' }], phoneNumbers: [{ value: '+55 11 99999-9999' }], metadata: { sources: [] } });
  assert.deepEqual(result, { resource_name: 'people/c1', etag: 'abc', name: 'Ana', emails: ['ana@example.com'], phones: ['+55 11 99999-9999'] });
});

test('write payload changes only supplied fields', () => {
  assert.deepEqual(personBody({ name: 'Ana', email: 'ana@example.com' }), { names: [{ unstructuredName: 'Ana' }], emailAddresses: [{ value: 'ana@example.com' }] });
});

test('writes require an explicit confirmation flag', () => {
  assert.throws(() => requireConfirmation({}), /confirm: true/);
  assert.doesNotThrow(() => requireConfirmation({ confirm: true }));
});
