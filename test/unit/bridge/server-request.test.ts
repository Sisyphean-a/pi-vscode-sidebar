import { describe, expect, it } from "vitest";
import { parseBridgeRpcRequest } from "../../../src/bridge/server-request.ts";

describe("parseBridgeRpcRequest", () => {
  it("parses authorized rpc requests and defaults missing params to empty object", () => {
    expect(
      parseBridgeRpcRequest({
        method: "POST",
        url: "/rpc",
        authorizationHeader: "secret-token",
        token: "secret-token",
        bodyText: JSON.stringify({ method: "getStatus" }),
      }),
    ).toEqual({
      method: "getStatus",
      params: {},
    });
  });

  it("rejects invalid json bodies with a bridge client error", () => {
    expect(() =>
      parseBridgeRpcRequest({
        method: "POST",
        url: "/rpc",
        authorizationHeader: "secret-token",
        token: "secret-token",
        bodyText: "{invalid",
      }),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: Failed to parse request JSON]`);

    try {
      parseBridgeRpcRequest({
        method: "POST",
        url: "/rpc",
        authorizationHeader: "secret-token",
        token: "secret-token",
        bodyText: "{invalid",
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "BRIDGE_INVALID_JSON",
        statusCode: 400,
      });
    }
  });
});
