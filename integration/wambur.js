// Ergänzung der Seitenhülle. Rechnungsdaten bleiben im Browser.
const tip = document.getElementById('ikTip');
function updateTip() {
  const country = document.getElementById('toCountry')?.value.toUpperCase();
  const currency = document.getElementById('cur')?.value.toUpperCase();
  const taxCase = document.getElementById('taxCase')?.value;
  tip?.classList.toggle('hide', !(country && country !== 'DE' || currency && currency !== 'EUR' || ['AE','K','G','O'].includes(taxCase)));
}
document.addEventListener('input', updateTip);
document.addEventListener('change', updateTip);
updateTip();
