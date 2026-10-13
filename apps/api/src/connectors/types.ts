export type RawSnapshot = {
  sourceCode: string;
  fetchedAt: string;
  payload: unknown;
  sha256: string;
};

export type NormalizedRecord = {
  sourceItemKey: string;
  payload: Record<string, unknown>;
};

export type Connector<TRecord extends NormalizedRecord> = {
  sourceCode: string;
  fetch(): Promise<RawSnapshot>;
  validate(snapshot: RawSnapshot): Promise<void>;
  normalize(snapshot: RawSnapshot): Promise<TRecord[]>;
  findDuplicateCandidates(
    records: TRecord[],
  ): Promise<Array<[TRecord, TRecord]>>;
};

export class ConnectorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorUnavailableError";
  }
}

export async function prepareImport<TRecord extends NormalizedRecord>(
  connector: Connector<TRecord>,
) {
  const snapshot = await connector.fetch();
  await connector.validate(snapshot);
  const records = await connector.normalize(snapshot);
  const duplicateCandidates = await connector.findDuplicateCandidates(records);
  return {
    snapshot,
    records,
    duplicateCandidates,
    requiresHumanApproval: true as const,
  };
}
