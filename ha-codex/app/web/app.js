'use strict';

const outputEl = document.getElementById('output');
const versionBadgeEl = document.getElementById('versionBadge');
const clearBtn = document.getElementById('clearBtn');
const testWriteBtn = document.getElementById('testWriteBtn');
const actionButtons = Array.from(document.querySelectorAll('button[data-endpoint]'));

let cachedOptions = null;

function setOutput(data) {
  outputEl.textContent = JSON.stringify(data, null, 2);
}

async function apiFetch(endpoint, init = {}) {
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json', ...(init.headers || {}) },
    ...init
  });

  const payload = await response.json();
  return { status: response.status, payload };
}

async function callEndpoint(endpoint) {
  setOutput({ loading: true, endpoint });

  try {
    const { status, payload } = await apiFetch(endpoint);
    setOutput({ status, ...payload });

    if (endpoint === 'api/options' && payload.ok) {
      cachedOptions = payload.data;
      if (versionBadgeEl) {
        versionBadgeEl.textContent = payload.version || 'unknown';
      }
      testWriteBtn.disabled = !payload.data.allow_test_write;
      testWriteBtn.title = payload.data.allow_test_write ? '' : 'Enable allow_test_write in add-on options first';
    }
  } catch (error) {
    setOutput({ ok: false, error: 'network_error', message: error.message });
  }
}

async function runTestWrite() {
  const note = window.prompt('Optional note for /config test file:', 'frontend test');
  if (note === null) return;

  setOutput({ loading: true, endpoint: 'api/test/write' });

  try {
    const { status, payload } = await apiFetch('api/test/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });

    setOutput({ status, ...payload });
  } catch (error) {
    setOutput({ ok: false, error: 'network_error', message: error.message });
  }
}

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    void callEndpoint(button.dataset.endpoint);
  });
});

testWriteBtn.addEventListener('click', () => {
  void runTestWrite();
});

clearBtn.addEventListener('click', () => {
  outputEl.textContent = 'Output cleared.';
});

// Load options at startup so the test-write button state is accurate.
void callEndpoint('api/options');
