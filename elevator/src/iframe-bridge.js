// iframe-bridge.js
// Small helper to include inside a game page loaded into the iframe.
// It listens to window.postMessage messages sent by the parent and
// converts simple axis events into synthetic keyboard events or custom callbacks.

(function () {
  function dispatchKeyboardEvent({ key, code, keyCode, metaKey, ctrlKey, altKey, shiftKey }) {
    try {
      const ev = new KeyboardEvent('keydown', {
        key: key || '',
        code: code || '',
        keyCode: keyCode || 0,
        bubbles: true,
        cancelable: true,
        composed: true,
        metaKey: !!metaKey,
        ctrlKey: !!ctrlKey,
        altKey: !!altKey,
        shiftKey: !!shiftKey
      });
      window.dispatchEvent(ev);
    } catch (err) {
      console.warn('dispatchKeyboardEvent error', err);
    }
  }

  function handleJoystickQuickmove(payload) {
    // Default: map up/down to ArrowUp/ArrowDown key events
    const dir = payload.direction;
    if (dir === 'up') dispatchKeyboardEvent({ key: 'ArrowUp', code: 'ArrowUp' });
    else if (dir === 'down') dispatchKeyboardEvent({ key: 'ArrowDown', code: 'ArrowDown' });
    // You can extend mapping for left/right or custom actions
  }

  window.addEventListener('message', (ev) => {
    // Optional: verify origin
    // if (ev.origin !== 'https://elevator-xi.vercel.app') return;
    const msg = ev.data;
    if (!msg || msg.type !== 'axis-event') return;

    if (msg.event === 'joystick:quickmove') {
      handleJoystickQuickmove(msg.payload || {});
    } else if (msg.event === 'keydown') {
      dispatchKeyboardEvent(msg.payload || {});
    }
  });

  console.log('[iframe-bridge] ready to receive axis-event messages');
})();
