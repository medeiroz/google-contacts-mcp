function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function compactContact(person) {
  const names = person.names || [];
  return {
    resource_name: person.resourceName || '',
    etag: person.etag || '',
    name: names[0]?.displayName || names[0]?.unstructuredName || '',
    emails: (person.emailAddresses || []).map(item => item.value).filter(Boolean),
    phones: (person.phoneNumbers || []).map(item => item.value).filter(Boolean),
  };
}

function matchesQuery(person, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const contact = compactContact(person);
  const haystack = normalize([contact.name, ...contact.emails, ...contact.phones].join(' '));
  return terms.every(term => haystack.includes(term));
}

function personBody({ name, email, phone }) {
  const body = {};
  if (name !== undefined) body.names = name ? [{ unstructuredName: name }] : [];
  if (email !== undefined) body.emailAddresses = email ? [{ value: email }] : [];
  if (phone !== undefined) body.phoneNumbers = phone ? [{ value: phone }] : [];
  return body;
}

function updateContactEndpoint(resourceName) {
  return `${resourceName}:updateContact`;
}

function requireConfirmation(args) {
  if (args.confirm !== true) throw new Error('Set confirm: true to perform this write operation');
}

module.exports = { normalize, compactContact, matchesQuery, personBody, updateContactEndpoint, requireConfirmation };
