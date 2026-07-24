// CORETAP — onchain clicker
//
// This imports the real published npm package. Run `npm install` in this
// project before `npm run dev` — these imports will fail otherwise.
import { Sphere } from '@unicitylabs/sphere-sdk';
import { createBrowserProviders } from '@unicitylabs/sphere-sdk/impl/browser';
import { ConnectClient } from '@unicitylabs/sphere-sdk/connect';
import { ExtensionTransport, PostMessageTransport } from '@unicitylabs/sphere-sdk/connect/browser';

// Your Unicity ID (nametag). Claiming a nametag happens as part of
// Sphere.init() below — set the handle you want here.
const MY_NAMETAG = 'coretap-player-2'; // change this to whatever handle you want to claim

// Where clicks are sent. Sending to yourself still produces a real,
// confirmable transaction for scoring purposes.
const SINK_NAMETAG = '@coretap-player-2';

const COIN_ID = 'UCT';
const CLICK_AMOUNT = '1'; // 1 base unit = 0.000001 UCT per tap

const $ = (id) => document.getElementById(id);
const statusPill = $('statusPill');
const statusText = $('statusText');
const scoreLabel = $('scoreLabel');
const statScore = $('statScore');
const statConfirmed = $('statConfirmed');
const statPending = $('statPending');
const addrLine = $('addrLine');
const btnInit = $('btnInit');
const btnFaucet = $('btnFaucet');
const btnConnect = $('btnConnect');
const btnReset = $('btnReset');
const core = $('core');
const ledgerList = $('ledgerList');

$('sinkLabel').textContent = SINK_NAMETAG;

let sphere = null;
let confirmed = 0n;
let pendingCount = 0;
let queue = [];
let questIdentity = null;
let draining = false;
let txCounter = 0;

function setStatus(mode, text) {
  statusPill.className = 'status ' + mode;
  statusText.textContent = text;
}

function render() {
  const total = confirmed + BigInt(pendingCount);
  scoreLabel.textContent = total.toString();
  statScore.textContent = total.toString();
  statConfirmed.textContent = confirmed.toString();
  statPending.textContent = pendingCount.toString();
}

function spawnPulse() {
  const p = document.createElement('div');
  p.className = 'pulse';
  const angle = Math.random() * Math.PI * 2;
  const dist = 140 + Math.random() * 60;
  p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
  p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
  core.parentElement.appendChild(p);
  setTimeout(() => p.remove(), 950);
}

function addLedgerRow(id) {
  if (ledgerList.querySelector('.empty')) ledgerList.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'tx';
  row.id = 'tx-' + id;
  row.innerHTML = `<span class="id">#${id} send 1 base unit UCT → ${SINK_NAMETAG}</span><span class="st pending">pending</span>`;
  ledgerList.prepend(row);
  return row;
}

function updateLedgerRow(id, ok, note) {
  const row = document.getElementById('tx-' + id);
  if (!row) return;
  const st = row.querySelector('.st');
  st.className = 'st ' + (ok ? 'ok' : 'err');
  st.textContent = ok ? 'confirmed' : (note || 'failed');
}

async function initWallet() {
  setStatus('pending', 'connecting');
  btnInit.disabled = true;
  try {
    const { sphere: s, created, generatedMnemonic } = await Sphere.init({
      network: 'testnet',
      ...createBrowserProviders({ network: 'testnet' }),
      autoGenerate: true,
      nametag: MY_NAMETAG,
    });
    sphere = s;

    const handle = sphere.identity?.nametag ? '@' + sphere.identity.nametag : '(nametag not yet claimed)';
    addrLine.textContent = handle;
    btnFaucet.disabled = false;
    btnReset.disabled = false;

    if (created && generatedMnemonic) {
      addrLine.textContent += ' — SAVE THIS PHRASE: ' + generatedMnemonic;
    }

    render();
    setStatus('ready', 'connected · testnet');
    core.disabled = false;
  } catch (e) {
    console.error(e);
    setStatus('error', 'connection failed');
    addrLine.textContent = 'Wallet init failed: ' + (e?.message || e);
  } finally {
    btnInit.disabled = false;
  }
}

function detectConnectContext() {
  let inIframe;
  try { inIframe = window.top !== window.self; } catch { inIframe = true; }
  const hasExtension = typeof window.sphere !== 'undefined';
  return { inIframe, hasExtension };
}

function buildConnectTransport(ctx, popup) {
  if (ctx.inIframe) return PostMessageTransport.forClient();
  if (ctx.hasExtension) return ExtensionTransport.forClient();
  return PostMessageTransport.forClient({ target: popup, targetOrigin: 'https://wallet.unicity.network' });
}

async function trySilentConnect() {
  const ctx = detectConnectContext();
  if (!ctx.inIframe && !ctx.hasExtension) return;
  const client = new ConnectClient({
    transport: buildConnectTransport(ctx),
    dapp: { name: 'CORETAP', description: 'Hexagon onchain clicker', url: location.origin },
    silent: true,
  });
  try {
    const { identity } = await client.connect();
    questIdentity = identity;
    addrLine.textContent += '  ·  quest ID: ' + (identity?.nametag || identity);
  } catch {
    // not pre-approved yet — that's fine, button stays visible
  }
}

async function connectWallet() {
  const ctx = detectConnectContext();
  let popup = null;
  if (!ctx.inIframe && !ctx.hasExtension) {
    popup = window.open('https://wallet.unicity.network', 'sphere-connect', 'width=420,height=640');
    if (!popup) { setStatus('error', 'popup blocked'); return; }
  }
  const client = new ConnectClient({
    transport: buildConnectTransport(ctx, popup),
    dapp: { name: 'CORETAP', description: 'Hexagon onchain clicker', url: location.origin },
    silent: false,
  });
  try {
    const { identity } = await client.connect();
    questIdentity = identity;
    addrLine.textContent += '  ·  quest ID: ' + (identity?.nametag || identity);
  } catch (e) {
    console.error(e);
    setStatus('error', 'connect failed');
  }
}

function showFaucetInstructions() {
  btnFaucet.textContent = 'See console for steps';
  console.info(
    '[CORETAP] Faucet: claim a nametag first (done automatically above via',
    'Sphere.init), then follow the testnet faucet steps in the sphere-sdk',
    'repo\'s quickstart guide (Node.js/Browser), or import this same recovery',
    'phrase into the Sphere wallet app (sphere.unicity.network) and use its',
    '"Top Up" button, or use the faucet at quest.unicity.network.'
  );
  setTimeout(() => { btnFaucet.textContent = 'Faucet instructions'; }, 3000);
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const id = queue.shift();
    try {
      const result = await sphere.payments.send({
        recipient: SINK_NAMETAG,
        coinId: COIN_ID,
        amount: CLICK_AMOUNT,
      });
      pendingCount--;
      if (result?.success !== false) {
        confirmed += 1n;
        updateLedgerRow(id, true);
      } else {
        updateLedgerRow(id, false, result?.error || 'send failed');
      }
    } catch (e) {
      pendingCount--;
      const msg = /insufficient|balance/i.test(e?.message || '') ? 'insufficient UCT' : 'error';
      updateLedgerRow(id, false, msg);
      console.error(e);
    }
    render();
  }
  draining = false;
}

function handleTap() {
  if (!sphere) {
    setStatus('error', 'no wallet');
    return;
  }
  spawnPulse();
  txCounter++;
  const id = txCounter;
  pendingCount++;
  render();
  addLedgerRow(id);
  queue.push(id);
  drainQueue();
}

btnInit.addEventListener('click', initWallet);
btnFaucet.addEventListener('click', showFaucetInstructions);
btnConnect.addEventListener('click', connectWallet);
btnReset.addEventListener('click', () => {
  if (confirm('This clears local wallet state from this browser. Your onchain history remains, but you will lose access to it unless you saved the recovery phrase. Continue?')) {
    localStorage.clear();
    location.reload();
  }
});
core.addEventListener('click', handleTap);

setStatus('pending', 'no wallet');
render();
trySilentConnect();
  
