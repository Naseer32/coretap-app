// CORETAP — onchain clicker
//
// This imports the real published npm package. Run `npm install` in this
// project before `npm run dev` — these imports will fail otherwise.
import { Sphere } from '@unicitylabs/sphere-sdk';
import { createBrowserProviders } from '@unicitylabs/sphere-sdk/impl/browser';

// Your Unicity ID (nametag). Claiming a nametag happens as part of
// Sphere.init() below — set the handle you want here. Confirmed from the
// real SDK quickstart: nametag is an init param, not a separate call.
const MY_NAMETAG = 'coretap-player'; // change this to whatever handle you want to claim

// Where clicks are sent. Point this at any @handle you control (e.g. a
// second wallet, or your own — sending to yourself still produces a real,
// confirmable transaction for scoring purposes).
const SINK_NAMETAG = '@coretap-sink'; // replace with a real handle you control

const COIN_ID = 'UCT';
// UCT uses 6 decimals per the SDK's own example (1,000,000 base units = 1 UCT).
// 1 base unit per tap keeps each click as cheap as possible.
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
const btnReset = $('btnReset');
const core = $('core');
const ledgerList = $('ledgerList');

$('sinkLabel').textContent = SINK_NAMETAG;

let sphere = null;
let confirmed = 0n;
let pendingCount = 0;
let queue = [];
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
      ...createBrowserProviders({ network: 'testnet' }),
      autoGenerate: true,     // make a new wallet if one doesn't exist yet
      nametag: MY_NAMETAG,    // claim this Unicity ID — note the SDK docs say
                               // receiving via a nametag also needs an on-chain
                               // mint step; see docs/UNICITY-ID.md in the SDK repo
    });
    sphere = s;

    const handle = sphere.identity?.nametag ? '@' + sphere.identity.nametag : '(nametag not yet claimed)';
    addrLine.textContent = handle;
    btnFaucet.disabled = false;
    btnReset.disabled = false;

    if (created && generatedMnemonic) {
      // In a real app, show this in a proper modal and force the user to
      // confirm they've saved it — don't just log it.
      console.warn('NEW WALLET — SAVE THIS RECOVERY PHRASE:', generatedMnemonic);
      addrLine.title = 'New wallet created. Recovery phrase logged to your browser console — save it now.';
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

function showFaucetInstructions() {
  // Confirmed from the real SDK docs: there is no single programmatic
  // faucet call bundled into a generic method here. The actual flow is:
  // 1. Claim a Unicity ID (done above via nametag in Sphere.init).
  // 2. Request test tokens from the testnet faucet, following the
  //    Node.js or Browser quick-start guide in the sphere-sdk repo
  //    (docs reference a faucet step but the exact call/UI wasn't
  //    available to inspect directly — check the repo's quickstart docs
  //    or the Sphere wallet app's own "Top Up" button for the concrete
  //    steps at the time you're building this).
  btnFaucet.textContent = 'See console for steps';
  console.info(
    '[CORETAP] Faucet: claim a nametag first (done automatically above via',
    'Sphere.init), then follow the testnet faucet steps in the sphere-sdk',
    'repo\'s quickstart guide (Node.js/Browser) or use the Sphere wallet',
    'app\'s "Top Up" button on this same wallet (same recovery phrase).'
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
btnReset.addEventListener('click', () => {
  if (confirm('This clears local wallet state from this browser. Your onchain history remains, but you will lose access unless you saved your recovery phrase. Continue?')) {
    localStorage.clear();
    location.reload();
  }
});
core.addEventListener('click', handleTap);

setStatus('pending', 'no wallet');
render();
