import { describe, expect, it } from "vitest";
import {
  canManageTeam,
  defaultTeamAcceptUrl,
  displayNameFromEmail,
  initialsFromEmail,
  MEMBERSHIP_ROLES,
  roleLabel,
} from "./team";

describe("canManageTeam", () => {
  it("allows admin only", () => {
    expect(canManageTeam("admin")).toBe(true);
    expect(canManageTeam("Admin")).toBe(true);
    expect(canManageTeam("developer")).toBe(false);
    expect(canManageTeam("finance")).toBe(false);
    expect(canManageTeam("operator")).toBe(false);
    expect(canManageTeam("viewer")).toBe(false);
    expect(canManageTeam(null)).toBe(false);
    expect(canManageTeam(undefined)).toBe(false);
  });
});

describe("role helpers", () => {
  it("covers every MembershipRole chip", () => {
    expect(MEMBERSHIP_ROLES.map((r) => r.key)).toEqual([
      "admin",
      "developer",
      "finance",
      "operator",
      "viewer",
    ]);
  });

  it("labels known roles and falls back for unknown", () => {
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("developer")).toBe("Developer");
    expect(roleLabel("mystery")).toBe("mystery");
  });
});

describe("display helpers", () => {
  it("builds a readable name and initials from email", () => {
    expect(displayNameFromEmail("joethuku@elementpay.net")).toBe("Joethuku");
    expect(displayNameFromEmail("aly.mtsumi@elementpay.net")).toBe("Aly Mtsumi");
    expect(initialsFromEmail("aly.mtsumi@elementpay.net")).toBe("AM");
    expect(initialsFromEmail("info@elementpay.net")).toBe("IN");
  });
});

describe("defaultTeamAcceptUrl", () => {
  it("appends /team/accept to the origin", () => {
    expect(defaultTeamAcceptUrl("https://app.example.com")).toBe(
      "https://app.example.com/team/accept",
    );
    expect(defaultTeamAcceptUrl("https://app.example.com/")).toBe(
      "https://app.example.com/team/accept",
    );
  });
});
