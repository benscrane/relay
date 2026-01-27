// Web Crypto API global declaration for non-browser environments
declare const crypto: {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
  randomUUID(): string;
  subtle: SubtleCrypto;
};
