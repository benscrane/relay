const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 12;

export function generateId(length: number = ID_LENGTH): string {
  let id = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}

export function generateProjectId(): string {
  return `prj_${generateId()}`;
}

export function generateEndpointId(): string {
  return `ep_${generateId()}`;
}

export function generateUserId(): string {
  return `usr_${generateId()}`;
}

export function generateRuleId(): string {
  return `rul_${generateId()}`;
}
