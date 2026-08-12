import { describe, expect, it } from "vitest";

import { resolveInstaworkUser } from "./instaworkUser";

describe("resolveInstaworkUser", () => {
  it("returns null for null/undefined input", () => {
    expect(resolveInstaworkUser(null)).toBeNull();
    expect(resolveInstaworkUser(undefined)).toBeNull();
  });

  it("parses the production JSON:API user response (id + full_name)", () => {
    expect(
      resolveInstaworkUser({
        data: {
          type: "user",
          id: "12345678",
          attributes: {
            full_name: "Alex Worker",
            given_name: "Alex",
            family_name: "Worker",
          },
        },
      }),
    ).toEqual({ workerId: 12345678, name: "Alex Worker" });
  });

  it("coerces numeric JSON:API ids", () => {
    expect(
      resolveInstaworkUser({
        data: { id: 42, attributes: { given_name: "Sam", family_name: "Lee" } },
      }),
    ).toEqual({ workerId: 42, name: "Sam Lee" });
  });

  it("builds a name from given_name/family_name when full_name is absent", () => {
    expect(
      resolveInstaworkUser({
        data: { id: "99", attributes: { given_name: "Jamie", family_name: "Nguyen" } },
      }),
    ).toEqual({ workerId: 99, name: "Jamie Nguyen" });
  });

  it("accepts flat local-dev shapes with a top-level id", () => {
    expect(
      resolveInstaworkUser({ id: 7, first_name: "Pat", last_name: "Kim" }),
    ).toEqual({ workerId: 7, name: "Pat Kim" });
  });

  it("falls back to worker_id then pk", () => {
    expect(resolveInstaworkUser({ worker_id: 11, name: "Taylor" })).toEqual({
      workerId: 11,
      name: "Taylor",
    });
    expect(resolveInstaworkUser({ pk: 12, name: "Jordan" })).toEqual({
      workerId: 12,
      name: "Jordan",
    });
  });

  it("returns null when no usable worker id is present", () => {
    expect(resolveInstaworkUser({ data: { type: "user", attributes: {} } })).toBeNull();
    expect(resolveInstaworkUser({ data: { id: "not-a-number", attributes: {} } })).toBeNull();
  });

  it("returns a null name when no name fields are present", () => {
    expect(resolveInstaworkUser({ data: { id: "5", attributes: {} } })).toEqual({
      workerId: 5,
      name: null,
    });
  });
});
