import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

// `firebase emulators:exec` が FIRESTORE_EMULATOR_HOST を設定する
const app = initializeApp({ projectId: "demo-mise-playground" });
const db = getFirestore(app);

describe("firestore emulator", () => {
  it("書き込んだドキュメントを読み戻せる", async () => {
    const ref = db.collection("greetings").doc("hello");
    await ref.set({ message: "hello mise" });
    const snap = await ref.get();
    expect(snap.data()).toEqual({ message: "hello mise" });
  });

  it("エミュレータに接続している", () => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy();
  });
});
