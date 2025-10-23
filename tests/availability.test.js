const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/availability');

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    jsonPayload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    }
  };
}

test('returns 400 when appointmentTypeId is missing', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('fetch should not be called');
  };

  try {
    const req = { query: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.jsonPayload, { error: 'Missing or invalid appointmentTypeId' });
  } finally {
    global.fetch = originalFetch;
  }
});

test('returns grouped availability when Acuity responds successfully', async () => {
  const originalFetch = global.fetch;

  process.env.ACUITY_MAIN_USER_ID = '123';
  process.env.ACUITY_MAIN_API_KEY = 'abc';
  process.env.ACUITY_PARENTS_USER_ID = '456';
  process.env.ACUITY_PARENTS_API_KEY = 'def';
  process.env.ACUITY_DEFAULT_DAYS = '5';
  process.env.TZ_DEFAULT = 'UTC';

  let fetchCalledWith;

  global.fetch = async (url, options) => {
    fetchCalledWith = { url, options };
    return {
      ok: true,
      async json() {
        return [
          { time: '2024-01-01T15:00:00Z' },
          { time: '2024-01-03T16:30:00Z' }
        ];
      }
    };
  };

  try {
    const req = {
      query: {
        appointmentTypeId: '789',
        days: '4',
        timezone: 'UTC',
        start: '2024-01-01'
      }
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Cache-Control'], 's-maxage=300, stale-while-revalidate=600');
    assert.deepEqual(res.jsonPayload, {
      startDate: '2024-01-01',
      endDate: '2024-01-04',
      days: [
        { date: '2024-01-01', times: ['3:00 PM'] },
        { date: '2024-01-03', times: ['4:30 PM'] }
      ]
    });

    assert.ok(fetchCalledWith);
    assert.match(fetchCalledWith.url, /appointmentTypeID=789/);
    assert.match(fetchCalledWith.url, /ownerID=123/);
    assert.match(fetchCalledWith.url, /startDate=2024-01-01/);
    assert.match(fetchCalledWith.url, /endDate=2024-01-04/);
  } finally {
    global.fetch = originalFetch;
  }
});
