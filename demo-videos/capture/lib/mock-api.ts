import type { Page, Route } from "playwright";
import { APP_URL, DEMO } from "./session";

export type MockOptions = {
  /**
   * Give the demo user a SubmitClaimAuthorization grant (service agent) so
   * the "New Claim" button shows and claims can be submitted. When false the
   * user has no role and sees the "Apply as Contributor" path instead.
   */
  serviceAgent?: boolean;
};

/* ------------------------------------------------------------------ *
 * Pre-generated protobuf fixtures (scripts kept in the PR description;
 * regenerated with the app's @ixo/impactxclient-sdk):
 * - QueryAccountResponse: BaseAccount for DEMO.sessionAddress, acc#1, seq 0
 * - QueryGranteeGrantsResponse: SubmitClaimAuthorization from
 *   DEMO.adminAddress to DEMO.address constrained to DEMO.collectionId
 * ------------------------------------------------------------------ */
const ACCOUNT_RESPONSE_B64 =
  "ClIKIC9jb3Ntb3MuYXV0aC52MWJldGExLkJhc2VBY2NvdW50Ei4KKml4bzE5cmw0Y20yaG1yOGFmeTRrbGRweHozZmthNGpndXEwYXI0bjBteBgB";
const SA_GRANTS_RESPONSE_B64 =
  "Cr8BCippeG8xZGVtb2FkbWluMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDASKWl4bzFkZXZieXBhc3NhZGRyZXNzMDAwMDAwMDAwMDAwMDAwMDAwMDAwGmYKLC9peG8uY2xhaW1zLnYxYmV0YTEuU3VibWl0Q2xhaW1BdXRob3JpemF0aW9uEjYKKml4bzFkZW1vYWRtaW4wMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMBIICgQxMDQyEGQ=";

const TX_HASH = "DEADBEEF".repeat(8);

/* ----------------------------- fixtures ----------------------------- */

const cellnodeService = (ownerId: string) => [
  {
    id: `${ownerId}#cellnode`,
    type: "Cellnode",
    serviceEndpoint: "https://cellnode.demo.ixo.earth/",
  },
];

const PROJECT_ENTITY = {
  id: DEMO.entityDid,
  type: "project",
  status: 1,
  owner: DEMO.adminAddress,
  accounts: [],
  entityVerified: true,
  linkedEntity: [],
  linkedResource: [],
  service: cellnodeService(DEMO.entityDid),
  settings: { Profile: { serviceEndpoint: "cellnode:public/profile1" } },
};

const PROTOCOL_ENTITY = {
  id: DEMO.protocolDid,
  type: "protocol/claim",
  status: 0,
  owner: DEMO.adminAddress,
  accounts: [],
  entityVerified: true,
  linkedEntity: [],
  linkedResource: [
    {
      id: `${DEMO.protocolDid}#vct-1`,
      type: "surveyTemplate",
      description: "Claim form",
      mediaType: "application/json",
      serviceEndpoint: "cellnode:public/vct1",
      proof: "",
      encrypted: "false",
      right: "",
    },
    {
      id: `${DEMO.protocolDid}#bco`,
      type: "surveyTemplate",
      description: "Contributor application form",
      mediaType: "application/json",
      serviceEndpoint: "cellnode:public/bco1",
      proof: "",
      encrypted: "false",
      right: "",
    },
  ],
  service: cellnodeService(DEMO.protocolDid),
  settings: {},
};

const COLLECTION = {
  id: DEMO.collectionId,
  entity: DEMO.entityDid,
  admin: DEMO.adminAddress,
  protocol: DEMO.protocolDid,
  startDate: "2025-01-01T00:00:00Z",
  endDate: "2030-01-01T00:00:00Z",
  state: 0,
  count: 12,
  quota: 100,
  evaluated: 8,
  approved: 7,
  rejected: 1,
  disputed: 0,
  payments: { approval: { amount: [{ denom: "uixo", amount: "1000000" }] } },
};

const PROFILE_JSON = { name: DEMO.projectName, logo: "/images/logo.png" };

const VCT_FORM = {
  title: DEMO.formTitle,
  completeText: "Submit Claim",
  pages: [
    {
      name: "p1",
      elements: [
        {
          type: "radiogroup",
          name: "site",
          title: "Which site did you plant at?",
          isRequired: true,
          choices: ["North Field", "River Bend", "School Grove"],
        },
        {
          type: "text",
          name: "trees",
          title: "How many trees did you plant?",
          isRequired: true,
        },
        {
          type: "comment",
          name: "notes",
          title: "Notes for the evaluator",
        },
      ],
    },
  ],
};

const BCO_FORM = {
  title: "Contributor Application",
  completeText: "Submit Application",
  pages: [
    {
      name: "p1",
      elements: [
        {
          type: "text",
          name: "fullName",
          title: "Your full name",
          isRequired: true,
        },
        {
          type: "comment",
          name: "motivation",
          title: "Why do you want to contribute to this project?",
          isRequired: true,
        },
      ],
    },
  ],
};

/* --------------------------- helpers --------------------------- */

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "*",
};

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  });

/** Wrap a handler so cross-origin CORS preflights always succeed. */
const withCors =
  (handler: (route: Route) => Promise<void>) => async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    try {
      await handler(route);
    } catch {
      // Route may be gone if the page/browser closed mid-request.
    }
  };

const notFound = (route: Route, errcode = "M_NOT_FOUND") =>
  json(route, { errcode, error: "Not found" }, 404);

/**
 * Intercept every backend the app talks to with canned fixtures, so flows run
 * with no real auth hub, Matrix homeserver, bots, worker, blocksync, or chain.
 *
 * Playwright matches routes in reverse registration order, so the generic
 * external-blocking catch-all is registered FIRST and specific handlers after.
 */
export async function mockApi(page: Page, opts: MockOptions = {}): Promise<void> {
  const appOrigin = new URL(APP_URL).origin;

  // Mutable state so the demo world reacts to the user's actions.
  const state = {
    bidSubmitted: false,
    claims: opts.serviceAgent
      ? [
          {
            claimId: "bafyreidemoclaim000000000000000000000000000000001",
            collectionId: DEMO.collectionId,
            paymentsStatus: null,
            schemaType: null,
            submissionDate: "2026-08-20T09:12:00Z",
            evaluationByClaimId: {
              status: 1,
              evaluationDate: "2026-08-21T10:00:00Z",
              oracle: "did:ixo:entity:demooracle0001",
            },
          },
          {
            claimId: "bafyreidemoclaim000000000000000000000000000000002",
            collectionId: DEMO.collectionId,
            paymentsStatus: null,
            schemaType: null,
            submissionDate: "2026-08-23T14:30:00Z",
            evaluationByClaimId: null,
          },
        ]
      : ([] as any[]),
  };

  /* --- catch-all: let the app origin through, block everything else --- */
  await page.route(
    "**/*",
    withCors(async (route) => {
      const url = route.request().url();
      // Fonts keep the captured typography identical to production.
      if (url.startsWith(appOrigin) || /fonts\.(googleapis|gstatic)\.com/.test(url)) {
        await route.continue();
        return;
      }
      console.warn("[mock-api] blocked un-mocked external request:", url);
      await json(route, { error: "blocked by demo-videos mock-api" }, 404);
    }),
  );

  /* --- app-origin API proxies --- */
  await page.route(
    "**/api/yomaWorker/**",
    withCors(async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/v1/entities")) {
        await json(route, { data: { entities: [DEMO.entityDid] } });
      } else if (path.includes("/v1/collections/")) {
        await json(route, {
          data: { entityDid: DEMO.entityDid, blacklist: [] },
        });
      } else {
        await json(route, { data: {} });
      }
    }),
  );

  // Yoma-link status check soft-fails in the app; mimic the current behavior.
  await page.route(
    "**/api/yomaSync/**",
    withCors(async (route) => json(route, {}, 500)),
  );

  await page.route(
    "**/api/feegrant/**",
    withCors(async (route) => json(route, { granted: true })),
  );

  /* --- blocksync GraphQL --- */
  await page.route(
    /\/graphql(\?|$)/,
    withCors(async (route) => {
      const body = (route.request().postDataJSON() ?? {}) as { query?: string };
      const q = body.query ?? "";
      if (q.includes("getProtocolEntityByEntityId")) {
        const id = /id:\s*\{\s*equalTo:\s*"([^"]+)"/.exec(q)?.[1];
        const node = id === DEMO.entityDid ? PROJECT_ENTITY : PROTOCOL_ENTITY;
        await json(route, { data: { entities: { nodes: [node] } } });
      } else if (
        q.includes("getCollectionsByEntity") ||
        q.includes("entityCollectionCount")
      ) {
        await json(route, {
          data: { claimCollections: { nodes: [COLLECTION] } },
        });
      } else if (
        q.includes("getClaimsByClaimCollectionIds") ||
        q.includes("getAllClaimsByCollectionId")
      ) {
        await json(route, { data: { claims: { nodes: state.claims } } });
      } else {
        await json(route, { data: {} });
      }
    }),
  );

  /* --- chain RPC (Tendermint JSON-RPC over HTTP POST) --- */
  await page.route(
    /\.ixo\.earth\/rpc/,
    withCors(async (route) => {
      const body = (route.request().postDataJSON() ?? {}) as {
        id?: number | string;
        method?: string;
        params?: Record<string, any>;
      };
      const reply = (result: unknown) =>
        json(route, { jsonrpc: "2.0", id: body.id ?? -1, result });

      switch (body.method) {
        case "status":
          await reply(STATUS_RESULT);
          return;
        case "abci_query": {
          const path = body.params?.path ?? "";
          let value = "";
          if (path.includes("authz") && path.includes("GranteeGrants")) {
            value = opts.serviceAgent ? SA_GRANTS_RESPONSE_B64 : "";
          } else if (path.includes("auth.v1beta1.Query/Account")) {
            value = ACCOUNT_RESPONSE_B64;
          }
          await reply({
            response: {
              code: 0,
              log: "",
              info: "",
              index: "0",
              key: null,
              value,
              proofOps: null,
              height: "100",
              codespace: "",
            },
          });
          return;
        }
        case "broadcast_tx_sync":
          await reply({
            code: 0,
            data: "",
            log: "",
            codespace: "",
            hash: TX_HASH,
          });
          return;
        case "tx_search":
          await reply({
            total_count: "1",
            txs: [
              {
                hash: TX_HASH,
                height: "100",
                index: 0,
                tx_result: {
                  code: 0,
                  data: "",
                  log: "[]",
                  info: "",
                  gas_wanted: "200000",
                  gas_used: "100000",
                  events: [],
                  codespace: "",
                },
                tx: "CgA=",
              },
            ],
          });
          return;
        default:
          await reply({});
      }
    }),
  );

  /* --- Matrix homeserver (host-agnostic: login goes to the user-id domain) --- */
  await page.route(
    /\.well-known\/matrix\/client/,
    withCors(async (route) => {
      const origin = new URL(route.request().url()).origin;
      await json(route, { "m.homeserver": { base_url: origin } });
    }),
  );

  await page.route(
    /\/_matrix\//,
    withCors(async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const p = url.pathname;
      const method = req.method();

      if (p.endsWith("/login")) {
        await json(route, {
          access_token: "demo-matrix-token",
          device_id: "DEMODEVICE",
          user_id: DEMO.matrixUserId,
          well_known: { "m.homeserver": { base_url: url.origin } },
        });
      } else if (p.endsWith("/versions")) {
        await json(route, {
          versions: ["v1.1", "v1.5", "v1.11"],
          unstable_features: {},
        });
      } else if (p.endsWith("/capabilities")) {
        await json(route, { capabilities: {} });
      } else if (p.includes("/pushrules")) {
        await json(route, {
          global: { override: [], content: [], room: [], sender: [], underride: [] },
        });
      } else if (p.includes("/filter")) {
        if (method === "POST") await json(route, { filter_id: "0" });
        else await notFound(route);
      } else if (p.endsWith("/sync")) {
        // Long-poll politely on incremental syncs so the client doesn't
        // hot-spin against an instantly-responding mock.
        if (url.searchParams.has("since")) {
          await new Promise((r) => setTimeout(r, 25_000));
        }
        await json(route, {
          next_batch: "s1",
          rooms: { join: {}, invite: {}, leave: {} },
          presence: { events: [] },
          account_data: { events: [] },
          to_device: { events: [] },
          device_lists: { changed: [], left: [] },
          device_one_time_keys_count: { signed_curve25519: 50 },
        });
      } else if (p.endsWith("/keys/upload")) {
        await json(route, { one_time_key_counts: { signed_curve25519: 50 } });
      } else if (p.endsWith("/keys/query")) {
        await json(route, {
          device_keys: {},
          master_keys: {},
          self_signing_keys: {},
          user_signing_keys: {},
          failures: {},
        });
      } else if (p.endsWith("/keys/claim")) {
        await json(route, { one_time_keys: {}, failures: {} });
      } else if (p.includes("/room_keys/version")) {
        if (method === "POST") await json(route, { version: "1" });
        else await notFound(route);
      } else if (p.includes("/device_signing/upload")) {
        await json(route, {});
      } else if (p.includes("/account_data/")) {
        if (method === "PUT") await json(route, {});
        else await notFound(route);
      } else if (p.includes("/profile/")) {
        await json(route, { displayname: DEMO.displayName, avatar_url: null });
      } else if (p.includes("/openid/request_token")) {
        await json(route, {
          access_token: "demo-openid-token",
          token_type: "Bearer",
          matrix_server_name: url.hostname,
          expires_in: 3600,
        });
      } else {
        await json(route, {});
      }
    }),
  );

  /* --- Matrix bots (bid / claim / rooms) --- */
  const pendingSaBid = () => ({
    id: "mock-bid-0001",
    role: "SA",
    status: "pending",
    collection: DEMO.collectionId,
    did: DEMO.did,
    data: "{}",
    createdAt: "2026-08-25T08:00:00Z",
  });

  const botHandler = withCors(async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    if (p.endsWith("/media/upload")) {
      await json(route, { data: { cid: "bafyreidemomedia0000000000000000000000000000001" } });
      return;
    }
    const body = (req.postDataJSON() ?? {}) as { action?: string; flags?: any };
    switch (body.action) {
      case "get-bids-by-did":
      case "get-bids":
        await json(route, { data: state.bidSubmitted ? [pendingSaBid()] : [] });
        return;
      case "submit-bid":
        state.bidSubmitted = true;
        await json(route, { id: "mock-bid-0001", data: pendingSaBid() });
        return;
      case "save-claim": {
        const cid = `bafyreidemoclaim0000000000000000000000000000000${state.claims.length + 1}`;
        state.claims.push({
          claimId: cid,
          collectionId: DEMO.collectionId,
          paymentsStatus: null,
          schemaType: null,
          submissionDate: new Date().toISOString(),
          evaluationByClaimId: null,
        });
        await json(route, { data: { cid } });
        return;
      }
      default:
        await json(route, { data: [] });
    }
  });
  await page.route(/bid\.bot\./, botHandler);
  await page.route(/claim\.bot\./, botHandler);
  await page.route(
    /rooms\.bot\./,
    withCors(async (route) => json(route, { data: {} })),
  );

  /* --- cellnode (profile JSON + SurveyJS templates) --- */
  await page.route(
    /cellnode/,
    withCors(async (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p.includes("public/profile1")) await json(route, PROFILE_JSON);
      else if (p.includes("public/vct1")) await json(route, VCT_FORM);
      else if (p.includes("public/bco1")) await json(route, BCO_FORM);
      else await notFound(route, "NOT_FOUND");
    }),
  );

  /* --- email notifier: report an active subscription so no prompt opens --- */
  await page.route(
    /email\.notifications/,
    withCors(async (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p.includes(".well-known/did.json")) {
        await json(route, { id: "did:key:zDemoNotifier" });
      } else if (p.includes("/api/subscription")) {
        await json(route, {
          status: "active",
          address: DEMO.address,
          did: DEMO.did,
          created_at: 0,
          updated_at: 0,
          preferences: [],
        });
      } else {
        await json(route, {});
      }
    }),
  );
}

/* Tendermint /status fixture — enough for Tendermint34Client.connect and
 * SigningStargateClient.getChainId. */
const STATUS_RESULT = {
  node_info: {
    protocol_version: { p2p: "8", block: "11", app: "0" },
    id: "0000000000000000000000000000000000000000",
    listen_addr: "tcp://0.0.0.0:26656",
    network: "demo-1",
    version: "0.34.24",
    channels: "40202122233038606100",
    moniker: "demo",
    other: { tx_index: "on", rpc_address: "tcp://0.0.0.0:26657" },
  },
  sync_info: {
    latest_block_hash: "A".repeat(64),
    latest_app_hash: "B".repeat(64),
    latest_block_height: "100",
    latest_block_time: "2026-08-25T00:00:00Z",
    earliest_block_hash: "A".repeat(64),
    earliest_app_hash: "B".repeat(64),
    earliest_block_height: "1",
    earliest_block_time: "2026-01-01T00:00:00Z",
    catching_up: false,
  },
  validator_info: {
    address: "0".repeat(40),
    pub_key: {
      type: "tendermint/PubKeyEd25519",
      value: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    },
    voting_power: "0",
  },
};
