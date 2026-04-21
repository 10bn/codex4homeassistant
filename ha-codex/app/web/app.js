'use strict';

const outputEl = document.getElementById('output');
const clearBtn = document.getElementById('clearBtn');
const actionButtons = Array.from(document.querySelectorAll('button[data-endpoint]'));

function setOutput(data) {
  outputEl.textContent = JSON.stringify(data, null, 2);
}

async function callEndpoint(endpoint) {
  setOutput({ loading: true, endpoint });

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    const payload = await response.json();
    setOutput({ status: response.status, ...payload });
  } catch (error) {
    setOutput({
      ok: false,
      error: 'network_error',
      message: error.message
    });
  }
}

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    void callEndpoint(button.dataset.endpoint);
  });
});

clearBtn.addEventListener('click', () => {
  outputEl.textContent = 'Output cleared.';
});
