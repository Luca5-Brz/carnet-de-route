import test from "node:test";
import assert from "node:assert/strict";
import {
  distance,
  total,
  groups,
  validate,
  backup,
  csv,
  migrate,
  inProgress,
  finishTrip,
  saveTrip,
  chainTrip,
  allowance,
  compensation,
  selectExport,
  eventCsv,
} from "../js/data.js";
const data = {
  vehicles: [
    { id: "v1", name: "Fourgon", plate: "ABC" },
    { id: "v2", name: "Auto", plate: "" },
  ],
  events: [
    { id: "e1", name: "Ancien", date: "2026-01-01", place: "" },
    { id: "e2", name: "Récent", date: "2026-02-01", place: "Liège" },
  ],
  trips: [
    {
      id: "t1",
      vehicle: "v1",
      event: "e2",
      date: "2026-02-02",
      start: 100,
      end: 125,
      note: 'Bonjour; "Excel"\nLigne 2',
    },
    {
      id: "t2",
      vehicle: "v2",
      event: "e2",
      date: "2026-02-03",
      start: 50,
      end: 70,
      note: "",
    },
    {
      id: "t3",
      vehicle: "v1",
      event: "e1",
      date: "2026-01-01",
      start: 0,
      end: 10,
      note: "",
    },
  ],
};
test("distances nulles et totaux", () => {
  assert.equal(distance({ start: 10, end: 10 }), 0);
  assert.equal(total(data.trips), 55);
});
test("hiérarchie événement / véhicule / trajets, dates décroissantes et totaux", () => {
  const g = groups(data);
  assert.deepEqual(
    g.map((g) => g.event.id),
    ["e2", "e1"],
  );
  assert.equal(g[0].total, 45);
  assert.deepEqual(
    g[0].vehicles.map((v) => [v.vehicle.id, v.total, v.trips.length]),
    [
      ["v1", 25, 1],
      ["v2", 20, 1],
    ],
  );
});
test("sauvegarde JSON complète sans perte", () =>
  assert.deepEqual(
    validate(JSON.parse(backup(data))),
    validate({ version: 1, data }),
  ));
test("validation : format, références, doublons, dates, distances et compteurs", () => {
  for (const mutate of [
    (x) => (x.version = 4),
    (x) => (x.data.trips[0].end = 99),
    (x) => (x.data.trips[0].start = -1),
    (x) => (x.data.trips[0].start = 1.5),
    (x) => (x.data.trips[0].vehicle = "absent"),
    (x) => (x.data.events[0].date = "2026-02-30"),
    (x) => x.data.vehicles.push(x.data.vehicles[0]),
    (x) => delete x.data.events,
    (x) => (x.data.vehicles[0].name = "  "),
  ]) {
    const x = JSON.parse(backup(data));
    mutate(x);
    assert.throws(() => validate(x));
  }
});
test("CSV Excel : BOM, séparateur, échappement, accents et formules neutralisées", () => {
  const d = structuredClone(data);
  d.events[1].name = "=CMD";
  const text = csv(d);
  assert.ok(text.startsWith("\uFEFF"));
  assert.ok(text.includes('"\'=CMD"'));
  assert.ok(text.includes('"Bonjour; ""Excel""\nLigne 2"'));
  assert.equal(text.split("\r\n").length, 4);
});
test("migration du prototype : trajets conservés et date événement inférée", () => {
  const legacy = structuredClone(data);
  delete legacy.events[1].date;
  delete legacy.events[1].place;
  const migrated = migrate(legacy);
  assert.equal(migrated.events[1].date, "2026-02-03");
  assert.deepEqual(migrated.trips, validate({ version: 1, data }).trips);
});
const active = (id, vehicle = "v1") => ({
  id,
  vehicle,
  event: "e2",
  date: "2026-02-04",
  start: 200,
  end: null,
  note: "À terminer",
  status: "in-progress",
});
test("anciens trajets et sauvegardes V1 normalisés comme terminés sans perte", () => {
  const normalized = validate({ version: 1, data });
  assert.ok(normalized.trips.every((t) => t.status === "completed"));
  assert.deepEqual(
    normalized.trips.map(({ status, rate, createdAt, ...t }) => t),
    data.trips,
  );
});
test("plusieurs trajets en cours, un seul par véhicule ; contrôle aussi en modification/import", () => {
  const d = structuredClone(data);
  d.trips.push(active("a"), active("b", "v2"));
  const valid = validate({ version: 2, data: d });
  assert.equal(valid.trips.filter(inProgress).length, 2);
  d.trips.push(active("c"));
  assert.throws(() => validate({ version: 2, data: d }), /Un seul trajet/);
  d.trips.pop();
  d.trips.at(-1).vehicle = "v1";
  assert.throws(() => validate({ version: 2, data: d }), /Un seul trajet/);
});
test("trajets en cours visibles dans la hiérarchie, exclus de tous les totaux et CSV explicite", () => {
  const d = structuredClone(data);
  d.trips.push(active("a"));
  assert.equal(distance(d.trips.at(-1)), 0);
  assert.equal(total(d.trips), 55);
  const g = groups(d)[0];
  assert.equal(g.total, 45);
  assert.equal(g.vehicles[0].total, 25);
  assert.equal(g.vehicles[0].trips.length, 2);
  const text = csv(d);
  assert.ok(text.includes('"200";"";"";"En cours"'));
  assert.ok(text.includes('"Terminé"'));
});
test("terminer un trajet valide l’arrivée, conserve ses données et libère le véhicule", () => {
  const d = structuredClone(data);
  d.trips.push(active("a"));
  for (const end of [199, -1, NaN, Infinity, 200.5, null, "250"])
    assert.throws(() => finishTrip(d, "a", end));
  const done = finishTrip(d, "a", 225);
  assert.equal(done.trips.at(-1).status, "completed");
  assert.equal(total(done.trips), 80);
  assert.deepEqual(done.trips.at(-1), {
    ...active("a"),
    status: "completed",
    end: 225,
    rate: 0,
    createdAt: 3,
  });
  assert.equal(d.trips.at(-1).end, null);
  assert.equal(distance(finishTrip(d, "a", 200).trips.at(-1)), 0);
  assert.throws(() => finishTrip(done, "a", 250));
  assert.throws(() => finishTrip(d, "absent", 250));
  done.trips.push(active("b"));
  assert.doesNotThrow(() => validate({ version: 2, data: done }));
});
test("JSON V2 : aller-retour des deux statuts et rejet des états incohérents", () => {
  const d = structuredClone(data);
  d.trips.push(active("a"));
  const saved = JSON.parse(backup(d));
  assert.equal(saved.version, 3);
  assert.deepEqual(validate(saved), validate({ version: 2, data: d }));
  for (const change of [
    (t) => (t.status = "unknown"),
    (t) => (t.end = 210),
    (t) => (t.start = -1),
    (t) => (t.vehicle = "absent"),
    (t) => delete t.end,
    (t) => (t.status = "completed"),
  ]) {
    const bad = structuredClone(saved);
    change(bad.data.trips.at(-1));
    assert.throws(() => validate(bad));
  }
});

test("V1.2 : tarif figé, arrondi par trajet et ordre stable après modification", () => {
  let d = validate({ version: 1, data });
  d.vehicles[0].rate = 0.4321;
  d = saveTrip(d, { ...active("new"), status: "completed", end: 225 });
  assert.equal(d.trips.at(-1).rate, 0.4321);
  assert.equal(allowance(d.trips.at(-1)), 10.8);
  d.vehicles[0].rate = 1;
  d = saveTrip(d, { ...d.trips.at(-1), note: "Modifié" });
  assert.equal(allowance(d.trips.at(-1)), 10.8);
  const createdAt = d.trips.at(-1).createdAt;
  d = saveTrip(d, { ...active("newer"), status: "completed", end: 210 });
  assert.equal(groups(d)[0].vehicles[0].trips[0].id, "newer");
  d = saveTrip(d, { ...d.trips.find((t) => t.id === "new"), note: "Encore" });
  assert.equal(d.trips.find((t) => t.id === "new").createdAt, createdAt);
  assert.equal(compensation(d.trips), 20.8);
});
test("V1.2 : enchaînement validé sans mutation, tarif à la clôture et rejet atomique", () => {
  const d = validate({ version: 2, data });
  d.vehicles[0].rate = 0.5;
  d.trips.push(active("old"));
  const next = chainTrip(d, { ...active("new"), start: 240 }, "old");
  assert.equal(next.trips.find((t) => t.id === "old").end, 240);
  assert.equal(next.trips.find((t) => t.id === "old").rate, 0.5);
  assert.equal(next.trips.filter(inProgress).length, 1);
  assert.equal(d.trips.at(-1).end, null);
  for (const changes of [
    { start: 199 },
    { date: "2026-01-01" },
    { event: "missing" },
  ]) {
    assert.throws(() => chainTrip(d, { ...active("new"), ...changes }, "old"));
    assert.equal(d.trips.at(-1).end, null);
  }
});
test("V1.2 : sélection export, commentaires intégraux et totaux", () => {
  const selected = selectExport(data, "e2", ["v1"]);
  assert.deepEqual(
    selected.trips.map((t) => t.id),
    ["t1"],
  );
  const text = eventCsv(selected);
  assert.ok(text.includes("TOTAL ÉVÉNEMENT"));
  assert.ok(text.includes("Ligne 2"));
  assert.ok(!text.includes("Auto"));
  assert.throws(() => selectExport(data, "e2", []));
});
test("V1.2 : migration idempotente et contrôle des nouveaux champs", () => {
  const migrated = validate({ version: 1, data });
  assert.deepEqual(validate(JSON.parse(backup(migrated))), migrated);
  assert.equal(migrated.trips[0].rate, null);
  assert.equal(migrated.vehicles[0].rate, 0);
  for (const rate of [-1, Infinity, "0.5", 0.12345]) {
    const invalid = structuredClone(migrated);
    invalid.vehicles[0].rate = rate;
    assert.throws(() => validate({ version: 3, data: invalid }));
  }
});

test("historical rates: preserve frozen rates, skip active and unset vehicles, remain idempotent", async () => {
  const { applyHistoricalRates } = await import("../js/data.js");
  const original = validate({ version: 1, data });
  original.vehicles[0].rate = 0.5;
  original.trips[2].rate = 0.25;
  original.trips.push(active("ongoing"));
  const next = applyHistoricalRates(original);
  assert.equal(next.trips[0].rate, 0.5);
  assert.equal(next.trips[1].rate, null);
  assert.equal(next.trips[2].rate, 0.25);
  assert.equal(next.trips.at(-1).rate, null);
  assert.equal(compensation(next.trips), 15);
  assert.equal(original.trips[0].rate, null);
  assert.deepEqual(applyHistoricalRates(next), next);
  assert.deepEqual(
    next.trips.map(({ rate, ...trip }) => trip),
    validate({ version: 3, data: original }).trips.map(
      ({ rate, ...trip }) => trip,
    ),
  );
  next.vehicles[1].rate = 1;
  const later = applyHistoricalRates(next);
  assert.equal(later.trips[1].rate, 1);
  assert.equal(later.trips[0].rate, 0.5);
  assert.deepEqual(validate(JSON.parse(backup(later))), later);
  assert.ok(csv(later).includes("12.50"));
});
