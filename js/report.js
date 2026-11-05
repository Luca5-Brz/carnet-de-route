import {
  groups,
  distance,
  total,
  inProgress,
  allowance,
  compensation,
} from "./data.js";

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
const money = (value) =>
  value.toLocaleString("fr-BE", { style: "currency", currency: "EUR" });

// Use the system PDF printer: no CDN, external request or personal-data upload.
export function printReport(data) {
  const report = window.open("", "_blank");
  if (!report) throw Error("Autorisez l’ouverture de l’aperçu PDF.");
  report.document
    .write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
        <title>Carnet de route — Export événement</title>
        <style>
            body { font: 12pt sans-serif; color: #111; margin: 24px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            td, th { padding: 8px; border: 1px solid #aaa; text-align: left; overflow-wrap: anywhere; }
            .note { white-space: pre-wrap; }
            thead { display: table-header-group; }
            h2, h3 { break-after: avoid; }
            @page { size: A4; margin: 15mm; }
            @media print { button { display: none; } }
        </style></head><body><h1>Carnet de route</h1>
        <button id="print">Imprimer / enregistrer en PDF</button>
        ${groups(data)
          .map(
            (group) => `<h2>${escape(group.event.name)}</h2>
            <p>${escape(group.event.date)} · ${escape(group.event.place)}</p>
            ${group.vehicles
              .map(
                ({
                  vehicle,
                  trips,
                }) => `<h3>${escape(vehicle.name)} · ${escape(vehicle.plate)}</h3>
                <table><thead><tr><th>Date / compteurs / statut</th><th>Remarque intégrale</th><th>Tarif et indemnité</th></tr></thead><tbody>
                ${trips
                  .map(
                    (
                      trip,
                    ) => `<tr><td>${escape(trip.date)}<br>${trip.start} → ${inProgress(trip) ? "En cours" : trip.end}<br>${inProgress(trip) ? "En cours" : distance(trip) + " km"}</td>
                    <td class="note">${escape(trip.note)}</td>
                    <td>${trip.rate == null ? "Tarif non renseigné" : escape(trip.rate) + " €/km"}<br>${inProgress(trip) || trip.rate == null ? "—" : money(allowance(trip))}</td></tr>`,
                  )
                  .join("")}
                </tbody></table><p>Total véhicule : ${total(trips)} km · ${money(compensation(trips))}</p>`,
              )
              .join("")}
            <p><b>Total événement : ${group.total} km · ${money(compensation(data.trips))}</b></p>`,
          )
          .join("")}
        <p>Les trajets en cours sont exclus des totaux. Indemnités connues uniquement : aucun montant n’est attribué aux anciens trajets sans tarif historique.</p>
        </body></html>`);
  report.document.close();
  report.document.getElementById("print").onclick = () => report.print();
  report.focus();
  report.print();
}
