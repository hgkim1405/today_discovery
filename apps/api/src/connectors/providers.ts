import {
  ConnectorUnavailableError,
  type Connector,
  type NormalizedRecord,
} from "./types.js";

type ProviderCode = "TOUR_API" | "SHARE_NURI" | "SEOUL_RESERVATION";

function gatedConnector(
  sourceCode: ProviderCode,
  credential: string | undefined,
): Connector<NormalizedRecord> {
  const reason = credential
    ? `${sourceCode} request schema and live response have not been verified`
    : `${sourceCode} credential is not configured`;
  return {
    sourceCode,
    async fetch() {
      throw new ConnectorUnavailableError(reason);
    },
    async validate() {
      throw new ConnectorUnavailableError(reason);
    },
    async normalize() {
      throw new ConnectorUnavailableError(reason);
    },
    async findDuplicateCandidates() {
      throw new ConnectorUnavailableError(reason);
    },
  };
}

export function providerConnectors(env: NodeJS.ProcessEnv = process.env) {
  return {
    tourApi: gatedConnector("TOUR_API", env.TOUR_API_KEY),
    shareNuri: gatedConnector("SHARE_NURI", env.SHARE_NURI_API_KEY),
    seoulReservation: gatedConnector(
      "SEOUL_RESERVATION",
      env.SEOUL_RESERVATION_API_KEY,
    ),
  };
}
