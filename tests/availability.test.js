import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/availability.js';

function createRes() {
  return {
    statusCode: 200,
    jsonPayload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    }
  };
}

test('availability handler returns ok response', async () => {
  const req = { query: {} };
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonPayload, { ok: true, path: '/api/availability' });
});
