import {
  finances,
  distance,
  total,
  groups,
  backup,
  csv,
  validate,
  inProgress,
  finishTrip,
  applyHistoricalRates,
  saveTrip,
  chainTrip,
  allowance,
  compensation,
  selectExport,
  eventCsv,
} from "./data.js";
import { printReport } from "./report.js";
import { open, write, read } from "./storage.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const money = (n) =>
  n.toLocaleString("fr-BE", { style: "currency", currency: "EUR" });
const km = (n) => n.toLocaleString("fr-BE") + " km";
const date = (s) => new Date(s + "T12:00:00").toLocaleDateString("fr-BE");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
let data,
  page = "home",
  edit = null,
  busy = false;
const titles = {
  finances: "Finances",
  payment: "Remboursement reçu",
  opening: "Solde initial",
  home: "Carnet de route",
  trip: "Démarrer un trajet",
  history: "Historique",
  manage: "Gestion",
  vehicle: "Véhicule",
  event: "Événement",
  finish: "Terminer le trajet",
};
function message(text, error = false) {
  $("#message").textContent = text;
  $("#message").className = error ? "error" : "success";
}
function go(next, id = null) {
  page = next;
  edit = id;
  render();
  window.scrollTo(0, 0);
  $("#title").focus();
}
const button = (label, action, id = "", cls = "link") => /* HTML */ `
  <button
    type="button"
    class="${cls}"
    data-action="${action}"
    data-id="${esc(id)}"
  >
    ${label}
  </button>
`;
function field(label, name, value = "", type = "text", required = true) {
  return /* HTML */ `
    <div class="field">
      <label for="${name}">${label}</label>
      <input
        id="${name}"
        name="${name}"
        type="${type}"
        value="${esc(value)}"
        ${required ? "required" : ""}
        ${
          type === "number"
            ? ["amount", "openingBalance"].includes(name)
              ? 'min="' +
                (name === "amount" ? '0.01' : '-1000000000') +
                '" max="1000000000" step="0.01" inputmode="decimal"'
              : name === "rate"
              ? 'min="0" step="0.0001" max="1000"'
              : 'min="0" step="1" max="9007199254740991"'
            : 'maxlength="500"'
        }
      />
    </div>
  `;
}
function tripForm() {
  const t = data.trips.find((t) => t.id === edit) || {
    date: today(),
    start: "",
    end: "",
    note: "",
    status: "in-progress",
  };
  if (!data.vehicles.length || !data.events.length)
    return /* HTML */ `
      <div class="card empty">
        Ajoutez d’abord un véhicule et un événement dans
        Gestion.${button("Ouvrir la gestion", "manage")}
      </div>
    `;
  const select = (label, name, list) => /* HTML */ `
    <div class="field">
      <label for="${name}">${label}</label>
      <select id="${name}" name="${name}" required>
        ${list
          .map(
            (x) => /* HTML */ `
              <option
                value="${esc(x.id)}"
                ${x.id === t[name] ? "selected" : ""}
              >
                ${esc(x.name)}${name === "event" ? " · " + date(x.date) : ""}
              </option>
            `,
          )
          .join("")}
      </select>
    </div>
  `;
  return /* HTML */ `
    <form data-form="trip">
      <div class="field">
        <label for="status">Saisie</label>
        <select id="status" name="status">
          <option value="completed" ${!inProgress(t) ? "selected" : ""}>
            Trajet complet
          </option>
          <option value="in-progress" ${inProgress(t) ? "selected" : ""}>
            Démarrer un trajet — En cours
          </option>
        </select>
      </div>
      ${select("Véhicule", "vehicle", data.vehicles)}${select(
        "Événement",
        "event",
        [...data.events].sort((a, b) => b.date.localeCompare(a.date)),
      )}${field("Date du trajet", "date", t.date, "date")}${field(
        "Compteur de départ (km)",
        "start",
        t.start,
        "number",
      )}
      <div id="arrival-field">
        ${field("Compteur d’arrivée (km)", "end", t.end ?? "", "number")}
      </div>
      <div class="distance">
        Distance calculée
        <output id="distance">— km</output>
      </div>
      <div class="field">
        <label for="note">Remarque (facultative)</label>
        <textarea id="note" name="note" maxlength="5000">
${esc(t.note)}</textarea>
      </div>
      <button class="primary">Enregistrer le trajet</button>
      ${
        edit ? button("Supprimer ce trajet", "delete-trip", edit, "danger") : ""
      }
    </form>
  `;
}
function management() {
  return /* HTML */ `
    <h2>Véhicules</h2>
    <div class="card">
      ${
        data.vehicles
          .map(
            (v) => /* HTML */ `
              <div class="listrow">
                <div>
                  <b>${esc(v.name)}</b>
                  <small> ${esc(v.plate || "Sans immatriculation")} </small>
                </div>
                ${button("Modifier", "vehicle", v.id)}
              </div>
            `,
          )
          .join("") || '<p class="empty">Aucun véhicule</p>'
      }
    </div>
    ${button("＋ Ajouter un véhicule", "vehicle")}
    <h2>Événements</h2>
    <div class="card">
      ${
        groups(data)
          .map(
            ({ event: e }) => /* HTML */ `
              <div class="listrow">
                <div>
                  <b>${esc(e.name)}</b>
                  <small>
                    ${date(e.date)}${e.place ? " · " + esc(e.place) : ""}
                  </small>
                </div>
                ${button("Modifier", "event", e.id)}
              </div>
            `,
          )
          .join("") || '<p class="empty">Aucun événement</p>'
      }
    </div>
    ${button("＋ Ajouter un événement", "event")} ${exportForm()}
    <h2>Indemnités des anciens trajets</h2>
    <div class="card backups">
      <p>
        Configurez le tarif dans chaque véhicule, puis appliquez-le aux anciens
        trajets terminés sans tarif. Les tarifs déjà figés sont conservés.
      </p>
      ${button("Comptabiliser les anciens trajets", "historical-rates")}
    </div>
    <h2>Sauvegardes</h2>
    <div class="card backups">
      ${button("Exporter CSV (Excel)", "csv")}${button(
        "Sauvegarder JSON",
        "json",
      )}
      <label class="file-label" for="restore">
        Restaurer une sauvegarde JSON
      </label>
      <input id="restore" type="file" accept="application/json,.json" />
      <p class="muted">
        La restauration remplace toutes les données après validation et
        confirmation. Exportez d’abord votre sauvegarde.
      </p>
    </div>
    <h2>Installation sur iPhone</h2>
    <p class="muted">
      Dans Safari : Partager → Sur l’écran d’accueil. Ouvrez une première fois
      avec Internet, puis attendez la confirmation « Hors ligne prêt ».
    </p>
  `;
}
function entityForm(type) {
  const plural = type === "vehicle" ? "vehicles" : "events",
    x = data[plural].find((x) => x.id === edit) || {
      name: "",
      plate: "",
      date: today(),
      place: "",
    };
  return /* HTML */ `
    <form data-form="${type}">
      ${field("Nom", "name", x.name)}${
        type === "vehicle"
          ? field(
              "Immatriculation (facultative)",
              "plate",
              x.plate,
              "text",
              false,
            ) +
            field("Tarif kilométrique (€/km)", "rate", x.rate ?? 0, "number")
          : field("Date de l’événement", "date", x.date, "date") +
            field("Lieu (facultatif)", "place", x.place, "text", false)
      }
      <button class="primary">Enregistrer</button>
      ${edit ? button("Supprimer", "delete-" + type, edit, "danger") : ""}
    </form>
  `;
}
function history() {
  return (
    groups(data)
      .map(
        (g) => /* HTML */ `
          <section class="card event-group">
            <header>
              <div>
                <h2>${esc(g.event.name)}</h2>
                <small>
                  ${date(g.event.date)}${
                    g.event.place ? " · " + esc(g.event.place) : ""
                  }
                </small>
              </div>
              <strong
                >${km(g.total)}<br />${money(compensation(g.vehicles.flatMap((v) => v.trips)))}</strong
              >
            </header>
            ${
              g.vehicles
                .map(
                  (v) => /* HTML */ `
                    <section class="vehicle-group">
                      <div class="row">
                        <h3>${esc(v.vehicle.name)}</h3>
                        <b>${km(v.total)} · ${money(compensation(v.trips))}</b>
                      </div>
                      ${v.trips
                        .map(
                          (t) => /* HTML */ `
                            <button
                              class="trip"
                              data-status="${
                                inProgress(t) ? "in-progress" : "completed"
                              }"
                              data-action="trip"
                              data-id="${esc(t.id)}"
                            >
                              <span>
                                <strong> ${date(t.date)} </strong>
                                <small>
                                  ${km(t.start)} →
                                  ${inProgress(t) ? "En cours" : km(t.end)}${
                                    t.note ? "<br>" + esc(t.note) : ""
                                  }
                                </small>
                              </span>
                              <strong>
                                ${
                                  inProgress(t)
                                    ? "En cours"
                                    : km(distance(t)) +
                                      " · " +
                                      (t.rate == null
                                        ? "Tarif non renseigné"
                                        : money(allowance(t)))
                                }
                                ›
                              </strong>
                            </button>
                          `,
                        )
                        .join("")}
                    </section>
                  `,
                )
                .join("") ||
              '<p class="empty">Aucun trajet pour cet événement</p>'
            }
          </section>
        `,
      )
      .join("") ||
    '<p class="empty">Aucun événement. Commencez dans Gestion.</p>'
  );
}
function ongoing() {
  const trips = data.trips.filter(inProgress);
  return trips.length
    ? /* HTML */ `
        <h2>Trajets en cours</h2>
        ${trips
          .map(
            (t) => /* HTML */ `
              <section class="card ongoing">
                <h3>
                  ${esc(data.vehicles.find((v) => v.id === t.vehicle).name)}
                </h3>
                <p>
                  ${esc(data.events.find((e) => e.id === t.event).name)} ·
                  ${date(t.date)}
                </p>
                <p class="muted">En cours · Départ : ${km(t.start)}</p>
                ${button(
                  "Terminer le trajet",
                  "finish",
                  t.id,
                  "primary",
                )}${button("Modifier", "trip", t.id)}
              </section>
            `,
          )
          .join("")}
      `
    : "";
}
function finishForm() {
  const t = data.trips.find((t) => t.id === edit);
  if (!t || !inProgress(t))
    return '<p class="empty">Ce trajet n’est plus en cours.</p>';
  return /* HTML */ `
    <p>
      ${esc(data.vehicles.find((v) => v.id === t.vehicle).name)} ·
      ${esc(data.events.find((e) => e.id === t.event).name)}
    </p>
    <p>Départ : ${km(t.start)}</p>
    <form data-form="finish">
      ${field("Compteur d’arrivée (km)", "end", "", "number")}
      <div class="distance">
        Distance calculée
        <output id="distance">— km</output>
      </div>
      <button class="primary">Terminer le trajet</button>
    </form>
  `;
}
function render() {
  $("#title").textContent =
    page === "trip" && edit ? "Modifier le trajet" : titles[page];
  $("#view").innerHTML =
    page === "finances"
      ? financeView()
      : ["payment", "opening"].includes(page)
        ? financeForm()
      : page === "home"
      ? /* HTML */ `
          <p class="eyebrow">VOTRE CARNET PERSONNEL</p>
          <div class="stats">
            <div class="stat">
              <strong>${km(total(data.trips))}</strong>
              <span>Total enregistré · ${money(compensation(data.trips))}</span>
            </div>
            <div class="stat">
              <strong>${data.trips.length}</strong>
              <span>Trajets</span>
            </div>
          </div>
          ${button("＋ Démarrer un trajet", "trip", "", "primary")}${ongoing()}
          <h2>Vos déplacements, simplement.</h2>
          <p class="muted">
            Véhicules, événements et trajets restent sur cet appareil. Pensez à
            exporter régulièrement une sauvegarde.
          </p>
          <div class="card menu">
            ${button("Consulter l’historique", "history")}${button(
              "Véhicules, événements et sauvegardes",
              "manage",
            )}
          </div>
        `
      : page === "trip"
        ? tripForm()
        : page === "history"
          ? history()
          : page === "manage"
            ? management()
            : page === "finish"
              ? finishForm()
              : entityForm(page);
  $("#nav").innerHTML = [
    ["home", "⌂", "Accueil"],
    ["trip", "＋", "Démarrer un trajet"],
    ["history", "◷", "Historique"],
    ["finances", "€", "Finances"],
    ["manage", "⚙", "Gestion"],
  ]
    .map(
      ([p, i, label]) => /* HTML */ `
        <button data-action="${p}" ${page === p ? 'aria-current="page"' : ""}>
          <b aria-hidden="true">${i}</b>
          ${label}
        </button>
      `,
    )
    .join("");
  updateDistance();
}
function updateDistance() {
  const f = $('[data-form="trip"], [data-form="finish"]');
  if (!f) return;
  const active = f.elements.status?.value === "in-progress";
  const b = f.elements.end;
  if (f.elements.status) {
    $("#arrival-field").hidden = active;
    b.disabled = active;
    b.required = !active;
  }
  const start =
    f.elements.start?.value ?? data.trips.find((t) => t.id === edit)?.start;
  b.setCustomValidity(
    !active && start !== "" && b.value !== "" && +b.value < +start
      ? "Le compteur d’arrivée doit être supérieur ou égal au départ."
      : "",
  );
  $("#distance").textContent = active
    ? "En cours"
    : start !== "" && b.value !== "" && +b.value >= +start
      ? km(+b.value - +start)
      : "— km";
  if (f.elements.vehicle) {
    const conflict =
      active &&
      data.trips.some(
        (t) =>
          t.id !== edit &&
          t.vehicle === f.elements.vehicle.value &&
          inProgress(t),
      );
    f.elements.vehicle.setCustomValidity(
      conflict && edit
        ? "Ce véhicule a déjà un trajet en cours. Terminez-le ou choisissez un autre véhicule."
        : "",
    );
  }
}
async function commit(next) {
  data = await write(next);
  message("Données enregistrées sur cet appareil.");
}
function download(content, type, extension) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `carnet-route-${today()}.${extension}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener("input", updateDistance);
document.addEventListener("change", updateDistance);
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || busy || !data) return;
  const action = b.dataset.action,
    id = b.dataset.id;
  try {
    if (action === "historical-rates") {
      const next = applyHistoricalRates(data);
      const changed = next.trips.filter(
        (trip, index) =>
          trip.rate !== data.trips[index].rate && trip.rate !== null,
      );
      if (!changed.length) {
        message(
          "Aucun ancien trajet à comptabiliser. Configurez un tarif supérieur à zéro dans vos véhicules.",
        );
        return;
      }
      const details = next.vehicles
        .map((vehicle) => {
          const trips = changed.filter((trip) => trip.vehicle === vehicle.id);
          return trips.length
            ? vehicle.name +
                " : " +
                trips.length +
                " trajet(s), " +
                km(total(trips)) +
                " à " +
                vehicle.rate +
                " €/km = " +
                money(compensation(trips))
            : "";
        })
        .filter(Boolean)
        .join("\n");
      if (
        !confirm(
          "Appliquer les tarifs actuels aux anciens trajets ?\n\n" +
            details +
            "\n\nCes tarifs seront figés. Les compteurs et les tarifs déjà enregistrés restent inchangés.",
        )
      )
        return;
      busy = true;
      await commit(next);
      render();
      message(
        changed.length +
          " ancien(s) trajet(s) comptabilisé(s) : " +
          money(compensation(changed)) +
          ".",
      );
      return;
    }
    if (action === "refresh") {
      await refresh();
      return;
    }
    if (action.startsWith("delete-")) {
      const type = action.slice(7),
        list = {
          trip: "trips",
          vehicle: "vehicles",
          event: "events",
          payment: "payments",
        }[type];
      if (type !== "trip" && data.trips.some((t) => t[type] === id)) {
        message(
          "Suppression impossible : cet élément est utilisé par des trajets. Modifiez leurs associations pour conserver les trajets.",
          true,
        );
        return;
      }
      if (!confirm("Supprimer définitivement cet élément ?")) return;
      busy = true;
      const next = structuredClone(data);
      next[list] = next[list].filter((x) => x.id !== id);
      await commit(next);
      go(type === "payment" ? "finances" : type === "trip" ? "history" : "manage");
    } else if (action === "csv")
      download(csv(data), "text/csv;charset=utf-8", "csv");
    else if (action === "json")
      download(backup(data), "application/json", "json");
    else go(action, id || null);
  } catch (error) {
    message("Échec : " + error.message, true);
  } finally {
    busy = false;
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy || !e.target.dataset.form) return;
  busy = true;
  const submit =
    e.submitter || e.target.querySelector("[type=submit],button.primary");
  submit.disabled = true;
  try {
    const type = e.target.dataset.form,
      x = Object.fromEntries(new FormData(e.target));
    for (const k in x) x[k] = x[k].trim();
    if (type === "payment" || type === "opening") {
      const next = structuredClone(data);
      if (type === "opening") next.openingBalance = Number(x.openingBalance);
      else {
        const payment = {
          id: edit || crypto.randomUUID(),
          date: x.date,
          amount: Number(x.amount),
          comment: x.comment,
        };
        const index = next.payments.findIndex((item) => item.id === edit);
        if (index < 0) next.payments.push(payment);
        else {
          if (!confirm("Confirmer la modification de ce remboursement ?")) return;
          next.payments[index] = payment;
        }
      }
      await commit(next);
      go("finances");
    } else if (type === "export") {
      const selected = selectExport(
        data,
        x.event,
        new FormData(e.target).getAll("vehicles"),
      );
      if (e.submitter.value === "pdf") printReport(selected);
      else download(eventCsv(selected), "text/csv;charset=utf-8", "csv");
    } else if (type === "finish") {
      await commit(finishTrip(data, edit, Number(x.end)));
      go("home");
    } else {
      if (!x.name && type !== "trip") throw Error("Le nom est obligatoire.");
      if (type === "trip") {
        x.start = Number(x.start);
        x.end = x.status === "in-progress" ? null : Number(x.end);
      }
      x.id = edit || crypto.randomUUID();
      if (type === "vehicle") x.rate = Number(x.rate);
      if (type === "trip") {
        const previous =
          !edit &&
          inProgress(x) &&
          data.trips.find((t) => t.vehicle === x.vehicle && inProgress(t));
        if (
          previous &&
          !confirm(
            "Terminer le trajet en cours à " +
              x.start +
              " km et démarrer le nouveau trajet avec ce même compteur ?",
          )
        )
          return;
        await commit(
          previous ? chainTrip(data, x, previous.id) : saveTrip(data, x),
        );
        go(inProgress(x) ? "home" : "history");
        return;
      }
      const next = structuredClone(data),
        list = { trip: "trips", vehicle: "vehicles", event: "events" }[type],
        index = next[list].findIndex((y) => y.id === x.id);
      if (index < 0) next[list].push(x);
      else next[list][index] = x;
      await commit(next);
      go(type === "trip" ? (inProgress(x) ? "home" : "history") : "manage");
    }
  } catch (error) {
    message("Enregistrement impossible : " + error.message, true);
  } finally {
    busy = false;
    submit.disabled = false;
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id !== "restore" || !e.target.files.length || busy) return;
  busy = true;
  try {
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024)
      throw Error("Fichier trop volumineux (maximum 10 Mo).");
    const next = validate(JSON.parse(await file.text()));
    if (
      !confirm(
        `Remplacer les données actuelles par ${next.vehicles.length} véhicule(s), ${next.events.length} événement(s) et ${next.trips.length} trajet(s), ${next.payments.length} remboursement(s) reçu(s) et un solde initial de ${money(next.openingBalance)} ?`,
      )
    )
      return;
    await commit(next);
    go("manage");
    message("Sauvegarde restaurée.");
  } catch (error) {
    message("Restauration refusée : " + error.message, true);
  } finally {
    busy = false;
    e.target.value = "";
  }
});
try {
  data = await open();
  render();
} catch (error) {
  $("#view").innerHTML =
    '<p class="error">Impossible d’ouvrir les données locales. Rechargez la page et vérifiez que le stockage du navigateur est autorisé. Les anciennes données n’ont pas été effacées.</p>';
  message(error.message, true);
}
if ("serviceWorker" in navigator) {
  try {
    await navigator.serviceWorker.register("./sw.js");
    await navigator.serviceWorker.ready;
    $("#offline").textContent = "Hors ligne prêt";
  } catch {
    $("#offline").textContent =
      "Hors ligne indisponible : réessayez avec Internet.";
  }
}

function exportForm() {
  return `<h2>Exporter un événement</h2>
        <form data-form="export" class="card backups">
            <label for="export-event">Événement</label>
            <select id="export-event" name="event" required>
                ${groups(data)
                  .map(
                    ({ event }) =>
                      `<option value="${esc(event.id)}">${esc(event.name)}</option>`,
                  )
                  .join("")}
            </select>
            <fieldset><legend>Véhicules à inclure</legend>
                ${data.vehicles.map((v) => `<label><input type="checkbox" name="vehicles" value="${esc(v.id)}" checked> ${esc(v.name)}</label>`).join("")}
            </fieldset>
            <button type="submit" value="csv" class="primary">Exporter la sélection CSV</button>
            <button type="submit" value="pdf" class="primary">Exporter la sélection PDF</button>
            <p class="muted">PDF : choisir « Enregistrer dans Fichiers » dans l’aperçu d’impression. Les totaux excluent les trajets en cours ; les anciens tarifs inconnus ne sont pas estimés.</p>
        </form>`;
}

// Keep form nodes intact during refresh, including file selection, focus and caret.
async function refresh() {
  if (busy) return;
  busy = true;
  try {
    data = await read();
    if (!document.querySelector("form")) render();
    message("Données locales actualisées. Votre saisie est conservée.");
  } catch (error) {
    message("Actualisation impossible : " + error.message, true);
  } finally {
    busy = false;
  }
}
let pullStart = null;
document.addEventListener(
  "touchstart",
  (event) => {
    pullStart =
      window.scrollY === 0 && !event.target.closest("input, textarea, select")
        ? event.touches[0].clientY
        : null;
  },
  { passive: true },
);
document.addEventListener(
  "touchmove",
  (event) => {
    if (
      pullStart !== null &&
      event.touches[0].clientY - pullStart > 80 &&
      event.cancelable
    )
      event.preventDefault();
  },
  { passive: false },
);
document.addEventListener("touchend", (event) => {
  if (pullStart !== null && event.changedTouches[0].clientY - pullStart > 80)
    void refresh();
  pullStart = null;
});

function financeView() {
  const totals = finances(data);
  return /* HTML */ `
    <section class="card finance-summary">
      <h2>Solde restant dû</h2>
      <strong id="finance-balance">${money(totals.balance)}</strong>
      <p>Indemnités cumulées : ${money(totals.indemnities)}</p>
      <p>Solde initial : ${money(data.openingBalance)}</p>
      <p>Remboursements reçus : ${money(totals.paid)}</p>
      <p class="muted">Indemnités + solde initial − remboursements reçus.
        Un solde négatif indique une avance de l’employeur.</p>
      ${button("Modifier le solde initial", "opening")}
    </section>
    ${totals.unrated ? `<p class="muted">${totals.unrated} trajet(s) terminé(s) sans tarif : indemnités non incluses. Configurez les tarifs puis utilisez « Comptabiliser les anciens trajets » dans Gestion.</p>` : ""}
    <p class="muted">Les remboursements reçus sont les montants déjà versés par votre employeur.
      Ils sont globaux, sans lien avec un événement ou un véhicule.
      Les trajets en cours sont exclus des indemnités.</p>
    ${button("Ajouter un remboursement reçu", "payment", "", "primary")}
    <h2>Historique des remboursements reçus</h2>
    <div class="card">
      ${[...data.payments]
        .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
        .map((payment) => /* HTML */ `
        <div class="listrow">
          <div>
            <b>${money(payment.amount)}</b>
            <small>${date(payment.date)}</small>
            <small class="payment-comment">${esc(payment.comment)}</small>
          </div>
          ${button("Modifier", "payment", payment.id)}
        </div>
        `)
        .join("") || '<p class="empty">Aucun remboursement reçu</p>'}
    </div>
  `;
}
function financeForm() {
  if (page === "opening")
    return /* HTML */ `
    <p class="muted">Montant dû avant les trajets présents dans ce carnet.
      Une avance peut être saisie avec un montant négatif. Évitez d’inclure des indemnités déjà enregistrées.</p>
    <form data-form="opening">
      ${field("Solde initial (€)", "openingBalance", data.openingBalance, "number")}
      <button class="primary">Enregistrer le solde initial</button>
      ${button("Annuler", "finances")}
    </form>
  `;
  const payment = data.payments.find((item) => item.id === edit) || {
    date: today(),
    amount: "",
    comment: "",
  };
  return /* HTML */ `
    <form data-form="payment">
      ${field("Date du remboursement", "date", payment.date, "date")}
      ${field("Montant reçu (€)", "amount", payment.amount, "number")}
      <div class="field">
        <label for="comment">Commentaire (facultatif)</label>
        <textarea id="comment" name="comment" maxlength="5000">${esc(payment.comment)}</textarea>
      </div>
      <button class="primary">Enregistrer le remboursement</button>
      ${edit ? button("Supprimer ce remboursement", "delete-payment", edit, "danger") : ""}
      ${button("Annuler", "finances")}
    </form>
  `;
}
