export const ALL_ENTITIES_ID = "*";

let activeEntityHeader: string = ALL_ENTITIES_ID;

export function getActiveEntityHeader(): string {
  return activeEntityHeader;
}

export function setActiveEntityHeader(value: string): void {
  activeEntityHeader = value;
}
