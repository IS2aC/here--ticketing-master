// Barre latérale commune du tableau de bord Here! — <aside data-active="…"></aside>, à charger avant _icons.js.
(function () {
  const aside = document.querySelector('aside[data-active]');
  if (!aside) return;
  const active = aside.dataset.active;
  const main = [
    ['tableau', 'statistiques', 'Tableau de bord'],
    ['invites', 'participants', 'Invités', '320'],
    ['cartes', 'invitation', "Cartes d'invitation"],
    ['relances', 'relance', 'Relances et appels'],
    ['acces', 'scanner', "Contrôle d'accès"],
  ];
  const other = [
    ['evenements', 'calendrier', 'Mes événements', '2'],
    ['parametres', 'parametres', 'Paramètres'],
  ];
  const link = ([id, icon, label, count]) =>
    `<a class="${id === active ? 'on' : ''}"><i data-icon="${icon}"></i><span class="lb">${label}</span>${count ? `<em>${count}</em>` : ''}</a>`;
  aside.innerHTML = `
    <img class="logo" src="../logo/svg/logo-horizontal.svg" alt="Here!">
    <div class="ev"><span class="ic"><i data-icon="mariage"></i></span><div class="lb"><b>Mariage Aya &amp; Koffi</b><small>Sam. 13 déc · J−49</small></div></div>
    <nav>${main.map(link).join('')}</nav>
    <div class="sep">Compte</div>
    <nav>${other.map(link).join('')}</nav>
    <div class="help"><i data-icon="support"></i><b class="lb">Mariam, votre conseillère</b><small class="lb">Elle suit vos relances et appelle vos invités. Écrivez-lui à tout moment.</small></div>`;
})();
