// Refract, a theme plugin, marks the page stash-liquid-glass as its script
// runs, and Stash renders nothing until every plugin's script has loaded.
// Refract redraws scene cards from what it finds in them: it hides Stash's
// rating ribbon and popover row, rewrites every .rating-banner's text to its
// number and frames the card by it, and draws a chip for the scene's rating
// and a row of pills over the picture. Your score and the ⋯ menu take places
// of their own there.
export const refract = () =>
  document.documentElement.classList.contains('stash-liquid-glass')
