import assert from 'node:assert/strict';
import test from 'node:test';

import availability from '../api/availability.js';
import ping from '../api/ping.js';

function createResponse() {
  const res = {
    headers: {},
    statusCode: undefined,
    body: undefined
  };

  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };

  res.status = (code) => {
    res.statusCode = code;
    return {
      json: (payload) => {
        res.body = payload;
        return res;
      },
      end: () => res
    };
  };

  return res;
}

test('ping endpoint returns pong', async () => {
  const res = createResponse();
  await ping({ method: 'GET' }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { pong: true });
});

test('availability endpoint rejects missing params', async () => {
  const res = createResponse();
  await availability({ method: 'GET', query: {} }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    ok: false,
    error: 'Missing required query parameters'
  });
});

test('availability endpoint returns data when fetch succeeds', async () => {
  const sample = [{ start: '2025-01-01T08:00:00-07:00' }];
  const res = createResponse();

  const previousFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    json: async () => sample
  });

  try {
    const env = process.env;
    process.env = { ...process.env, ACUITY_USER_ID: 'user', ACUITY_API_KEY: 'key' };

    await availability(
      {
        method: 'GET',
        query: { location: 'parents', appointmentTypeId: '123' }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      ok: true,
      location: 'parents',
      appointmentTypeId: '123',
      times: sample
    });

    process.env = env;
  } finally {
    global.fetch = previousFetch;
  }
});
