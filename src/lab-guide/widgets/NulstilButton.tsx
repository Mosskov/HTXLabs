/** Testbed-only widget: wipes every `htxlabs:*` localStorage key and
 * redirects to the site root, mimicking a brand-new visitor. Currently
 * used in the hej-verden lab to verify the fresh-start experience. */
export function NulstilButton() {
  function handleClick() {
    const confirmed = window.confirm('Nulstil hele siden? Alle dine besvarelser og data slettes.');
    if (!confirmed) return;
    // Iterate backwards: removeItem shifts the remaining indices.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('htxlabs:')) localStorage.removeItem(key);
    }
    window.location.href = import.meta.env.BASE_URL;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-8 rounded border border-red-300 bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100"
    >
      Nulstil hele siden
    </button>
  );
}
