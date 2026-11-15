/* The music preference belongs to this device, independently of learning progress. */
(() => {
  const track = document.querySelector('#garden-music');
  const key = 'komorebi-garden-music-v1';
  let enabled = true;
  try { enabled = localStorage.getItem(key) !== 'off'; } catch {}
  track.volume = 0.33;
  let exploring = false;
  let blocked = false;
  const eligible = () => exploring && enabled && !document.hidden && !document.querySelector('dialog[open]');

  function display() {
    for (const button of document.querySelectorAll('[data-music]')) {
      const playing = !track.paused;
      const waitingForTap = enabled && blocked && !playing;
      button.setAttribute('aria-label', playing ? 'Pause garden music' : 'Play garden music');
      button.setAttribute('aria-pressed', String(playing));
      button.dataset.playing = String(playing);
      button.querySelector('.sound-action').textContent = playing ? 'Pause music' : waitingForTap ? 'Tap garden for music' : 'Play music';
    }
  }

  async function sync() {
    if (!eligible()) {
      track.pause();
    } else if (track.paused) {
      try { await track.play(); blocked = false; }
      catch (error) {
        blocked = error.name === 'NotAllowedError';
        if (error.name !== 'AbortError' && !blocked) {
          const status = document.querySelector('[data-music-status]');
          if (status) status.textContent = 'Music could not load. Tap to retry.';
        }
      }
    }
    display();
  }
  function activate(event) {
    if (event.target.closest('[data-music]') || !track.paused || !eligible()) return;
    sync();
  }
  // A touch grants playback permission on release. Movement buttons may consume the click.
  document.addEventListener('touchend', activate, {capture:true, passive:true});
  document.addEventListener('pointerup', activate, true);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-music]');
    if (!button) { activate(event); return; }
    enabled = track.paused;
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch {}
    sync();
  });
  document.addEventListener('keydown', event => {
    if (!event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) activate(event);
  });
  for (const event of ['playing','pause','error']) track.addEventListener(event, display);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { exploring = false; track.pause(); });
  new MutationObserver(sync).observe(document.querySelector('#modal'), {attributes:true, attributeFilter:['open']});
  window.KomorebiMusic = {setExplore(value) { exploring = value; sync(); }};
})();
