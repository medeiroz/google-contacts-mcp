#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { peopleRequest } = require('./src/auth');
const { compactContact, matchesQuery, personBody, requireConfirmation } = require('./src/people');
const pkg = require('./package.json');

const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers';

function json(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

async function listContacts(args = {}) {
  const pageSize = Math.min(Math.max(Number(args.page_size) || 100, 1), 1000);
  const response = await peopleRequest('people/me/connections', {
    query: { personFields: PERSON_FIELDS, pageSize, pageToken: args.page_token },
  });
  return {
    contacts: (response.connections || []).map(compactContact),
    next_page_token: response.nextPageToken || null,
    total_people: response.totalPeople ?? null,
  };
}

async function searchContacts(args = {}) {
  const query = String(args.query || '').trim();
  if (!query) throw new Error('query is required');
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 500);
  const matches = [];
  let pageToken;
  do {
    const response = await peopleRequest('people/me/connections', {
      query: { personFields: PERSON_FIELDS, pageSize: 1000, pageToken },
    });
    for (const person of response.connections || []) {
      if (matchesQuery(person, query)) {
        matches.push(compactContact(person));
        if (matches.length >= limit) return { contacts: matches, truncated: true };
      }
    }
    pageToken = response.nextPageToken;
  } while (pageToken);
  return { contacts: matches, truncated: false };
}

async function getContact(args = {}) {
  if (!args.resource_name) throw new Error('resource_name is required');
  return compactContact(await peopleRequest(args.resource_name, { query: { personFields: PERSON_FIELDS } }));
}

async function createContact(args = {}) {
  requireConfirmation(args);
  if (!args.name) throw new Error('name is required');
  return compactContact(await peopleRequest('people:createContact', {
    method: 'POST', body: personBody(args),
  }));
}

async function updateContact(args = {}) {
  requireConfirmation(args);
  if (!args.resource_name) throw new Error('resource_name is required');
  const fields = Object.keys(personBody(args));
  if (!fields.length) throw new Error('Provide at least one of name, email or phone');
  const existing = await peopleRequest(args.resource_name, { query: { personFields: PERSON_FIELDS } });
  const body = { ...existing, ...personBody(args) };
  return compactContact(await peopleRequest(args.resource_name, {
    method: 'PATCH', query: { updatePersonFields: fields.join(',') }, body,
  }));
}

async function deleteContact(args = {}) {
  requireConfirmation(args);
  if (!args.resource_name) throw new Error('resource_name is required');
  await peopleRequest(args.resource_name, { method: 'DELETE' });
  return { deleted: true, resource_name: args.resource_name };
}

async function contactsStats() {
  let count = 0;
  let pageToken;
  do {
    const response = await peopleRequest('people/me/connections', {
      query: { personFields: 'names', pageSize: 1000, pageToken },
    });
    count += (response.connections || []).length;
    pageToken = response.nextPageToken;
  } while (pageToken);
  return { contacts: count };
}

const tools = {
  list_contacts: { description: 'List a page of Google Contacts.', schema: { type: 'object', properties: { page_size: { type: 'integer', minimum: 1, maximum: 1000 }, page_token: { type: 'string' } } }, handler: listContacts },
  search_contacts: { description: 'Search Google Contacts locally by all words across name, email and phone.', schema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 500 } }, required: ['query'] }, handler: searchContacts },
  get_contact: { description: 'Get one Google Contact by People API resource name.', schema: { type: 'object', properties: { resource_name: { type: 'string' } }, required: ['resource_name'] }, handler: getContact },
  create_contact: { description: 'Create a Google Contact. Requires confirm: true.', schema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, confirm: { type: 'boolean' } }, required: ['name', 'confirm'] }, handler: createContact },
  update_contact: { description: 'Update supplied fields of a Google Contact. Requires confirm: true.', schema: { type: 'object', properties: { resource_name: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, confirm: { type: 'boolean' } }, required: ['resource_name', 'confirm'] }, handler: updateContact },
  delete_contact: { description: 'Permanently delete a Google Contact. Requires confirm: true.', schema: { type: 'object', properties: { resource_name: { type: 'string' }, confirm: { type: 'boolean' } }, required: ['resource_name', 'confirm'] }, handler: deleteContact },
  contacts_stats: { description: 'Count all Google Contacts.', schema: { type: 'object', properties: {} }, handler: contactsStats },
};

const server = new Server({ name: pkg.name, version: pkg.version }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: Object.entries(tools).map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.schema })) }));
server.setRequestHandler(CallToolRequestSchema, async request => {
  const tool = tools[request.params.name];
  if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
  try { return json(await tool.handler(request.params.arguments || {})); }
  catch (error) { return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }], isError: true }; }
});

async function main() { await server.connect(new StdioServerTransport()); }
main().catch(error => { console.error(`Fatal: ${error.message}`); process.exit(1); });

module.exports = { tools, listContacts, searchContacts, getContact, createContact, updateContact, deleteContact, contactsStats };
