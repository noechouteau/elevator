// iframe-bridge.js
// Small helper to include inside a game page loaded into the iframe.
// It listens to window.postMessage messages sent by the parent and
// converts simple axis events into synthetic keyboard events or custom callbacks.

(function () {
  // mark that bridge is installed
  try { window.__iframe_bridge_installed = true; } catch (_) {}
  function dispatchKeyboardEvent(type, { key, code, keyCode, metaKey, ctrlKey, altKey, shiftKey }) {
    try {
      const ev = new KeyboardEvent(type || 'keydown', {
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

  function pasteTextIntoActiveElement(text) {
    if (typeof text !== 'string') return;
    const el = document.activeElement;
    if (!el) return;

    // input or textarea
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const input = el;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const value = input.value || '';
      const newValue = value.slice(0, start) + text + value.slice(end);
      input.value = newValue;
      // set caret after pasted text
      const caret = start + text.length;
      try { input.setSelectionRange(caret, caret); } catch (e) {}
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // contenteditable
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      // move caret after inserted node
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }

  window.addEventListener('message', (ev) => {
    try { console.log('[iframe-bridge] message received', ev.origin, ev.data); } catch(_) {}
    // Optional: verify origin
    // if (ev.origin !== 'https://elevator-xi.vercel.app') return;
    const msg = ev.data;
    if (!msg || msg.type !== 'axis-event') return;

    if (msg.event === 'joystick:quickmove') {
      handleJoystickQuickmove(msg.payload || {});
    } else if (msg.event === 'joystick:move') {
      try {
        const p = msg.payload || {};
        const pos = p.position || { x: 0, y: 0 };
        // Dispatch a CustomEvent so the game can listen easily
        window.dispatchEvent(new CustomEvent('axis:joystickmove', { detail: { position: pos, id: p.id, joystick: p.joystick } }));
      } catch (err) {
        console.warn('[iframe-bridge] error handling joystick:move', err);
      }
    } else if (msg.event === 'keydown') {
      // If payload.code not provided, map from payload.key (single char) to expected codes
      const p = msg.payload || {};
      const mapping = {
        'a': 'KeyQ', // axis 'a' corresponds to game KeyQ
        'x': 'KeyS',
        'i': 'KeyD',
        's': 'KeyF'
      };
      const lowerKey = (p.key || '').toString().toLowerCase();
      const code = p.code || mapping[lowerKey] || p.code || '';
      dispatchKeyboardEvent('keydown', { key: p.key || '', code, keyCode: p.keyCode || 0, metaKey: p.metaKey, ctrlKey: p.ctrlKey, altKey: p.altKey, shiftKey: p.shiftKey });
    } else if (msg.event === 'keyup') {
      const p = msg.payload || {};
      const mapping = {
        'a': 'KeyQ',
        'x': 'KeyS',
        'i': 'KeyD',
        's': 'KeyF'
      };
      const lowerKey = (p.key || '').toString().toLowerCase();
      const code = p.code || mapping[lowerKey] || p.code || '';
      dispatchKeyboardEvent('keyup', { key: p.key || '', code, keyCode: p.keyCode || 0, metaKey: p.metaKey, ctrlKey: p.ctrlKey, altKey: p.altKey, shiftKey: p.shiftKey });
    } else if (msg.event === 'paste') {
      // payload: { text: '...' }
      pasteTextIntoActiveElement((msg.payload && msg.payload.text) || '');
    }
  });

  console.log('[iframe-bridge] ready to receive axis-event messages');
})();
