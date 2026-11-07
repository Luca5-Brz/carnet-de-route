export const empty = () => ({
  vehicles: [],
  events: [],
  trips: [],
  payments: [],
  openingBalance: 0,
});
export const inProgress = (t) => t.status === "in-progress";
export const distance = (t) => (inProgress(t) ? 0 : t.end - t.start);
export const total = (trips) => trips.reduce((sum, t) => sum + distance(t), 0);
const validDate = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
export function validate(input) {
  if (!input || ![1, 2, 3, 4].includes(input.version) || !input.data)
    throw Error(
      "Format de sauvegarde non reconnu (version 1, 2, 3 ou 4 requise).",
    );
  const d = input.data;
  for (const type of ["vehicles", "events", "trips"]) {
    if (!Array.isArray(d[type])) throw Error(`Liste ${type} manquante.`);
    const ids = new Set();
    for (const x of d[type]) {
      if (!x || typeof x.id !== "string" || !x.id || ids.has(x.id))
        throw Error("Identifiant absent ou dupliqué.");
      ids.add(x.id);
      if (type !== "trips" && (typeof x.name !== "string" || !x.name.trim()))
        throw Error("Nom obligatoire.");
      if (type === "vehicles" && x.rate !== undefined && !validRate(x.rate))
        throw Error("Tarif kilométrique invalide.");
      if (
        type === "trips" &&
        x.rate !== undefined &&
        x.rate !== null &&
        !validRate(x.rate)
      )
        throw Error("Tarif figé invalide.");
      if (
        type === "trips" &&
        x.createdAt !== undefined &&
        (!Number.isSafeInteger(x.createdAt) || x.createdAt < 0)
      )
        throw Error("Ordre de création invalide.");
      if (type === "vehicles" && typeof x.plate !== "string")
        throw Error("Immatriculation invalide.");
      if (
        type === "events" &&
        (!validDate(x.date) || typeof x.place !== "string")
      )
        throw Error("Date ou lieu de l’événement invalide.");
      if (
        type === "trips" &&
        (!validDate(x.date) ||
          !Number.isSafeInteger(x.start) ||
          x.start < 0 ||
          ![undefined, "completed", "in-progress"].includes(x.status) ||
          (inProgress(x)
            ? x.end !== null
            : !Number.isSafeInteger(x.end) || x.end < x.start) ||
          typeof x.note !== "string")
      )
        throw Error("Date, compteurs ou remarque du trajet invalides.");
    }
  }
  for (const t of d.trips)
    if (
      !d.vehicles.some((v) => v.id === t.vehicle) ||
      !d.events.some((e) => e.id === t.event)
    )
      throw Error("Un trajet référence un véhicule ou événement absent.");
  const activeVehicles = new Set();
  for (const t of d.trips.filter(inProgress)) {
    if (activeVehicles.has(t.vehicle))
      throw Error("Un seul trajet en cours est autorisé par véhicule.");
    activeVehicles.add(t.vehicle);
  }
  const payments = d.payments === undefined ? [] : d.payments;
  const openingBalance = d.openingBalance === undefined ? 0 : d.openingBalance;
  if (
    !Array.isArray(payments) ||
    !validMoney(openingBalance) ||
    (input.version === 4 &&
      (!Array.isArray(d.payments) || d.openingBalance === undefined))
  )
    throw Error("Données financières invalides.");
  const paymentIds = new Set();
  for (const payment of payments) {
    if (
      !payment ||
      typeof payment.id !== "string" ||
      !payment.id ||
      paymentIds.has(payment.id) ||
      !validDate(payment.date) ||
      !validMoney(payment.amount) ||
      payment.amount <= 0 ||
      typeof payment.comment !== "string" ||
      payment.comment.length > 5000 ||
      Object.keys(payment).some(
        (key) => !["id", "date", "amount", "comment"].includes(key),
      )
    )
      throw Error("Paiement global invalide.");
    paymentIds.add(payment.id);
  }
  return structuredClone({
    payments: payments.map(({ id, date, amount, comment }) => ({
      id,
      date,
      amount,
      comment,
    })),
    openingBalance,
    vehicles: d.vehicles.map(({ id, name, plate, rate = 0 }) => ({
      id,
      name,
      plate,
      rate,
    })),
    events: d.events.map(({ id, name, date, place }) => ({
      id,
      name,
      date,
      place,
    })),
    trips: d.trips.map(
      (
        {
          id,
          vehicle,
          event,
          date,
          start,
          end,
          note,
          status = "completed",
          rate = null,
          createdAt,
        },
        index,
      ) => ({
        id,
        vehicle,
        event,
        date,
        start,
        end,
        note,
        status,
        rate,
        createdAt: createdAt ?? index,
      }),
    ),
  });
}
export function groups(d) {
  return [...d.events]
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name),
    )
    .map((event) => {
      const trips = d.trips.filter((t) => t.event === event.id);
      return {
        event,
        total: total(trips),
        vehicles: d.vehicles
          .map((vehicle) => {
            const rows = trips
              .filter((t) => t.vehicle === vehicle.id)
              .sort(
                (a, b) =>
                  b.date.localeCompare(a.date) ||
                  (b.createdAt ?? d.trips.indexOf(b)) -
                    (a.createdAt ?? d.trips.indexOf(a)),
              );
            return { vehicle, trips: rows, total: total(rows) };
          })
          .filter((v) => v.trips.length),
      };
    });
}
export const backup = (d) =>
  JSON.stringify(
    {
      version: 4,
      exportedAt: new Date().toISOString(),
      data: validate({ version: 3, data: d }),
    },
    null,
    2,
  );
export function csv(d) {
  const cell = (value) =>
    '"' +
    String(value)
      .replace(/^[=+\-@\t\r\n]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const rows = [
    [
      "Événement",
      "Date événement",
      "Lieu",
      "Véhicule",
      "Immatriculation",
      "Date trajet",
      "Départ (km)",
      "Arrivée (km)",
      "Distance (km)",
      "Statut",
      "Remarque",
      "Tarif (EUR/km)",
      "Indemnité (EUR)",
    ],
  ];
  for (const g of groups(d))
    for (const v of g.vehicles)
      for (const t of v.trips)
        rows.push([
          g.event.name,
          g.event.date,
          g.event.place,
          v.vehicle.name,
          v.vehicle.plate,
          t.date,
          t.start,
          inProgress(t) ? "" : t.end,
          inProgress(t) ? "" : distance(t),
          inProgress(t) ? "En cours" : "Terminé",
          t.note,
          t.rate ?? "Non renseigné",
          inProgress(t) || t.rate == null ? "" : allowance(t).toFixed(2),
        ]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}
export function migrate(old) {
  const d = structuredClone(old);
  d.vehicles = d.vehicles.map((v) => ({ ...v, plate: v.plate || "" }));
  d.events = d.events.map((e) => ({
    ...e,
    date:
      e.date ||
      d.trips
        .filter((t) => t.event === e.id)
        .map((t) => t.date)
        .sort()
        .at(-1) ||
      new Date().toISOString().slice(0, 10),
    place: e.place || "",
  }));
  return validate({ version: 1, data: d });
}

export function finishTrip(data, id, end) {
  const next = structuredClone(data);
  const trip = next.trips.find((t) => t.id === id);
  if (!trip || !inProgress(trip)) throw Error("Ce trajet n’est plus en cours.");
  trip.end = end;
  trip.status = "completed";
  trip.rate = next.vehicles.find((v) => v.id === trip.vehicle).rate ?? 0;
  return validate({ version: 2, data: next });
}

// Rates use up to four decimal places; each reimbursement is rounded to cents.
const validRate = (value) =>
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1000 &&
  Math.abs(value * 10000 - Math.round(value * 10000)) < 0.000001;
export const allowance = (trip) =>
  inProgress(trip) || trip.rate == null
    ? 0
    : Math.round((distance(trip) * trip.rate + Number.EPSILON) * 100) / 100;
export const compensation = (trips) =>
  trips.reduce((sum, trip) => sum + Math.round(allowance(trip) * 100), 0) / 100;

export function saveTrip(data, incoming) {
  const next = validate({ version: 3, data });
  const old = next.trips.find((t) => t.id === incoming.id);
  const trip = {
    ...incoming,
    createdAt:
      old?.createdAt ??
      Math.max(Date.now(), ...next.trips.map((t) => t.createdAt + 1)),
  };
  trip.rate = inProgress(trip)
    ? null
    : old && !inProgress(old)
      ? old.rate
      : next.vehicles.find((v) => v.id === trip.vehicle)?.rate;
  const index = next.trips.findIndex((t) => t.id === trip.id);
  if (index < 0) next.trips.push(trip);
  else next.trips[index] = trip;
  return validate({ version: 3, data: next });
}

export function chainTrip(data, incoming, previousId) {
  const previous = data.trips.find((t) => t.id === previousId);
  if (
    !previous ||
    previous.vehicle !== incoming.vehicle ||
    incoming.id === previousId ||
    !inProgress(incoming)
  )
    throw Error("Enchaînement invalide.");
  if (incoming.date < previous.date)
    throw Error("Le nouveau trajet ne peut pas précéder le trajet en cours.");
  return saveTrip(finishTrip(data, previousId, incoming.start), incoming);
}

export function selectExport(data, eventId, vehicleIds) {
  if (
    !data.events.some((e) => e.id === eventId) ||
    !vehicleIds.length ||
    vehicleIds.some((id) => !data.vehicles.some((v) => v.id === id))
  )
    throw Error("Choisissez un événement et au moins un véhicule.");
  return {
    ...data,
    events: data.events.filter((e) => e.id === eventId),
    vehicles: data.vehicles.filter((v) => vehicleIds.includes(v.id)),
    trips: data.trips.filter(
      (t) => t.event === eventId && vehicleIds.includes(t.vehicle),
    ),
  };
}

export function eventCsv(data) {
  const cell = (value) =>
    '"' +
    String(value)
      .replace(/^[=+\-@\t\r\n]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const rows = [];
  for (const group of groups(data)) {
    for (const vehicle of group.vehicles)
      rows.push([
        "TOTAL VÉHICULE",
        vehicle.vehicle.name,
        total(vehicle.trips),
        compensation(vehicle.trips).toFixed(2),
      ]);
    rows.push([
      "TOTAL ÉVÉNEMENT",
      group.event.name,
      total(data.trips),
      compensation(data.trips).toFixed(2),
    ]);
  }
  return (
    csv(data) +
    "\r\n\r\n" +
    [
      ["Récapitulatif", "Nom", "Distance (km)", "Indemnité connue (EUR)"],
      ...rows,
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}

// Only historical completed trips without a frozen rate are eligible.
// Leave vehicles without a configured positive rate available for a later run.
export function applyHistoricalRates(data) {
  const next = validate({ version: 3, data });
  for (const trip of next.trips) {
    const vehicle = next.vehicles.find(
      (vehicle) => vehicle.id === trip.vehicle,
    );
    if (!inProgress(trip) && trip.rate === null && vehicle.rate > 0) {
      trip.rate = vehicle.rate;
    }
  }
  return next;
}

// Monetary inputs are bounded and represented as safe integer cents in totals.
const validMoney = (value) =>
  Number.isFinite(value) &&
  Math.abs(value) <= 1_000_000_000 &&
  Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;

export function finances(data) {
  const indemnities = compensation(data.trips);
  const paidCents = (data.payments ?? []).reduce(
    (sum, payment) => sum + Math.round(payment.amount * 100),
    0,
  );
  return {
    indemnities,
    paid: paidCents / 100,
    balance:
      (Math.round(indemnities * 100) +
        Math.round((data.openingBalance ?? 0) * 100) - paidCents) / 100,
    unrated: data.trips.filter(
      (trip) => !inProgress(trip) && trip.rate == null,
    ).length,
  };
}
