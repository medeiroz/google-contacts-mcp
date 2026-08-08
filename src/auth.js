const fs = require('node:fs/promises');
const path = require('node:path');

const TOKEN_PATH_ENV = 'GOOGLE_CONTACTS_TOKEN_PATH';

function tokenPathFromEnv(env = process.env) {
  const tokenPath = String(env[TOKEN_PATH_ENV] || '').trim();
  if (!tokenPath) {
    throw new Error(`${TOKEN_PATH_ENV} must point to an OAuth authorized-user token file`);
  }
  return path.resolve(tokenPath);
}

async function refreshAccessToken(tokenPath = tokenPathFromEnv()) {
  let token;
  try {
    token = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
  } catch {
    throw new Error('Unable to read the Google Contacts token file');
  }
  for (const key of ['client_id', 'client_secret', 'refresh_token']) {
    if (!token[key]) throw new Error(`OAuth token file is missing ${key}`);
  }

  const body = new URLSearchParams({
    client_id: token.client_id,
    client_secret: token.client_secret,
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token',
  });
  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw new Error('Unable to reach Google OAuth');
  }
  if (!response.ok) throw new Error(`Google OAuth refresh failed (${response.status})`);
  const refreshed = await response.json();
  if (!refreshed.access_token) throw new Error('Google OAuth refresh returned no access token');

  const updated = {
    ...token,
    access_token: refreshed.access_token,
    token_type: refreshed.token_type || 'Bearer',
    expiry_date: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
    ...(refreshed.scope ? { scope: refreshed.scope } : {}),
  };
  await fs.writeFile(tokenPath, JSON.stringify(updated, null, 2), { mode: 0o600 });
  await fs.chmod(tokenPath, 0o600);
  return refreshed.access_token;
}

async function peopleRequest(endpoint, { method = 'GET', query, body, tokenPath } = {}) {
  const accessToken = await refreshAccessToken(tokenPath);
  const url = new URL(`https://people.googleapis.com/v1/${endpoint.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Unable to reach Google People API');
  }
  if (!response.ok) throw new Error(`Google People API request failed (${response.status})`);
  if (response.status === 204) return {};
  return response.json();
}

module.exports = { TOKEN_PATH_ENV, tokenPathFromEnv, refreshAccessToken, peopleRequest };
