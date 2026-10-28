// Run with `npm test` (Node's built-in test runner, no extra libraries).
import assert from "node:assert/strict";
import { test } from "node:test";

import { care, decay, glitchText, newPet, TIME_SCALE } from "../src/lib/pet.ts";
import { allowAi } from "../src/lib/rateLimit.ts";

// Real milliseconds that equal `hours` of pet time.
const petHours = (hours: number) => (hours * 3_600_000) / TIME_SCALE;

test("a new pet starts healthy and unglitched", () => {
  const pet = newPet("Bugsy");
  assert.equal(pet.health, 100);
  assert.equal(pet.glitch_level, 0);
  assert.equal(pet.mood, 80);
});

test("needs drain over time and mood is their average", () => {
  const pet = decay(newPet("Bugsy"), petHours(1));
  assert.equal(pet.hunger, 70);
  assert.equal(pet.fun, 68);
  assert.equal(pet.mood, (70 + 74 + 73 + 68 + 76) / 5);
});

test("neglect raises the glitch level and hurts health", () => {
  const pet = decay(newPet("Bugsy"), petHours(10));
  assert.equal(pet.hunger, 0);
  assert.ok(pet.glitch_level > 0);
  assert.ok(pet.health < 100);
});

test("sleeping refills the sleep need", () => {
  const tired = { ...newPet("Bugsy"), sleep: 20 };
  assert.ok(decay(tired, petHours(1), true).sleep > 20);
});

test("stats stay between 0 and 100", () => {
  const fed = care(newPet("Bugsy"), { hunger: 500, fun: -500 });
  assert.equal(fed.hunger, 100);
  assert.equal(fed.fun, 0);
});

test("feeding updates last_fed_at", () => {
  const now = new Date("2000-01-01T00:00:00Z");
  assert.equal(care(newPet("Bugsy"), { hunger: 20 }, now).last_fed_at, now.toISOString());
});

test("text only scrambles once the pet is glitchy", () => {
  assert.equal(glitchText("hello world", 10), "hello world");
  assert.notEqual(glitchText("a".repeat(500), 100), "a".repeat(500));
});

test("each visitor gets 12 AI replies a minute", () => {
  const id = `test-${Math.random()}`;
  for (let i = 0; i < 12; i++) assert.equal(allowAi(id), true);
  assert.equal(allowAi(id), false);
});
