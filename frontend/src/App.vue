<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

// ============ 状态 ============
const nodeInfo = ref({ p2pPort: '-', apiPort: '-', blockCount: 0 })
const blockchain = ref([])
const peers = ref([])
const connected = ref(false)
const autoRefresh = ref(true)
const refreshInterval = ref(3000)
const loading = ref(false)
const error = ref('')
const lastUpdate = ref(null)

const miningData = ref('hello-blockchain')
const mining = ref(false)
const mineMsg = ref('')

const newPeer = ref('')
const connecting = ref(false)
const connectMsg = ref('')

let timer = null

// ============ API 调用 ============
const apiBase = '' // vite proxy 已配置

async function fetchJson(url) {
  const res = await fetch(apiBase + url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function postJson(url, body) {
  const res = await fetch(apiBase + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json().catch(() => null)
}

async function refreshAll() {
  loading.value = true
  error.value = ''
  try {
    const [chain, info, peerList] = await Promise.allSettled([
      fetchJson('/blocks'),
      fetchJson('/nodeInfo'),
      fetchJson('/peers')
    ])
    if (chain.status === 'fulfilled') {
      blockchain.value = chain.value
    }
    if (info.status === 'fulfilled') {
      nodeInfo.value = info.value
      connected.value = true
    } else {
      connected.value = false
    }
    if (peerList.status === 'fulfilled') {
      peers.value = peerList.value || []
    }
    lastUpdate.value = new Date()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function doMine() {
  mining.value = true
  mineMsg.value = ''
  try {
    await postJson('/mineBlock', { data: miningData.value })
    mineMsg.value = `✓ 挖矿成功`
    await refreshAll()
    setTimeout(() => mineMsg.value = '', 2000)
  } catch (e) {
    mineMsg.value = `✗ 挖矿失败: ${e.message}`
  } finally {
    mining.value = false
  }
}

async function doConnect() {
  if (!newPeer.value.trim()) return
  connecting.value = true
  connectMsg.value = ''
  try {
    await postJson('/addPeer', { peer: newPeer.value.trim() })
    connectMsg.value = `✓ 已发起连接`
    await refreshAll()
    setTimeout(() => connectMsg.value = '', 2000)
  } catch (e) {
    connectMsg.value = `✗ 连接失败: ${e.message}`
  } finally {
    connecting.value = false
  }
}

// ============ 生命周期 ============
onMounted(() => {
  refreshAll()
  timer = setInterval(() => {
    if (autoRefresh.value) refreshAll()
  }, refreshInterval.value)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// ============ 辅助 ============
function ts(ms) {
  if (!ms || ms < 1000000000000) return '-'
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}
function short(hash) {
  if (!hash) return ''
  if (hash.length <= 16) return hash
  return hash.slice(0, 8) + '...' + hash.slice(-6)
}
const sortedBlocks = computed(() => [...blockchain.value].reverse())
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <div class="logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="2" width="11" height="11" rx="2" stroke="var(--accent)" stroke-width="2"/>
            <rect x="19" y="2" width="11" height="11" rx="2" stroke="var(--accent)" stroke-width="2"/>
            <rect x="2" y="19" width="11" height="11" rx="2" stroke="var(--accent)" stroke-width="2"/>
            <rect x="19" y="19" width="11" height="11" rx="2" stroke="var(--accent)" stroke-width="2"/>
            <line x1="13" y1="7.5" x2="19" y2="7.5" stroke="var(--accent)" stroke-width="2"/>
            <line x1="7.5" y1="13" x2="7.5" y2="19" stroke="var(--accent)" stroke-width="2"/>
            <line x1="24.5" y1="13" x2="24.5" y2="19" stroke="var(--accent)" stroke-width="2"/>
            <line x1="13" y1="24.5" x2="19" y2="24.5" stroke="var(--accent)" stroke-width="2"/>
          </svg>
          <h1>QuKu Blockchain</h1>
        </div>
        <span class="tag">V1.0</span>
      </div>

      <div class="header-right">
        <div class="stat" :class="{ offline: !connected }">
          <span class="dot"></span>
          <span class="label">{{ connected ? '已连接' : '离线' }}</span>
        </div>
        <div class="stat">
          <span class="label">API</span>
          <span class="val">:{{ nodeInfo.apiPort }}</span>
        </div>
        <div class="stat">
          <span class="label">P2P</span>
          <span class="val">:{{ nodeInfo.p2pPort }}</span>
        </div>
        <div class="stat highlight">
          <span class="label">区块</span>
          <span class="val">{{ nodeInfo.blockCount }}</span>
        </div>
        <button @click="refreshAll" :disabled="loading" class="btn-refresh">
          <span v-if="loading">⋯</span>
          <span v-else>↻ 刷新</span>
        </button>
      </div>
    </header>

    <div class="main">
      <!-- Sidebar -->
      <aside class="sidebar">
        <!-- 挖矿面板 -->
        <div class="panel">
          <h2>⚡ 挖矿</h2>
          <div class="panel-body">
            <label>区块数据</label>
            <input v-model="miningData" placeholder="输入区块内容..." />
            <button @click="doMine" :disabled="mining" class="primary full">
              {{ mining ? '⏳ 挖矿中...' : '⚒ 挖新区块' }}
            </button>
            <div v-if="mineMsg" class="msg" :class="mineMsg.startsWith('✓') ? 'ok' : 'err'">{{ mineMsg }}</div>
          </div>
        </div>

        <!-- 节点连接 -->
        <div class="panel">
          <h2>🔗 连接节点</h2>
          <div class="panel-body">
            <label>地址 (host:port)</label>
            <input v-model="newPeer" placeholder="例: localhost 3001" />
            <button @click="doConnect" :disabled="connecting" class="full">
              {{ connecting ? '连接中...' : '连接' }}
            </button>
            <div v-if="connectMsg" class="msg" :class="connectMsg.startsWith('✓') ? 'ok' : 'err'">{{ connectMsg }}</div>
          </div>
        </div>

        <!-- 已连接节点 -->
        <div class="panel">
          <h2>🌐 已连接节点 ({{ peers.length }})</h2>
          <div class="panel-body">
            <div v-if="peers.length === 0" class="empty">暂无连接</div>
            <div v-else class="peer-list">
              <div v-for="(p, i) in peers" :key="i" class="peer">
                <span class="peer-idx">#{{ i+1 }}</span>
                <span class="peer-addr">{{ p }}</span>
                <span class="peer-status">●</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 设置 -->
        <div class="panel">
          <h2>⚙ 设置</h2>
          <div class="panel-body">
            <label class="toggle">
              <input type="checkbox" v-model="autoRefresh" />
              <span>自动刷新 ({{ refreshInterval/1000 }}s)</span>
            </label>
            <div v-if="lastUpdate" class="muted">上次更新: {{ ts(lastUpdate.getTime()) }}</div>
          </div>
        </div>
      </aside>

      <!-- 主区：区块链 -->
      <section class="content">
        <div class="content-header">
          <h2>⛓ 区块链浏览器</h2>
          <div v-if="error" class="err-box">⚠ {{ error }}</div>
        </div>

        <div v-if="blockchain.length === 0 && !loading" class="empty-chain">
          <div class="empty-icon">⛓</div>
          <p>区块链为空</p>
          <p class="muted">使用左侧面板挖第一个区块</p>
        </div>

        <div class="blocks">
          <template v-for="(block, i) in sortedBlocks" :key="block.hash || i">
            <!-- 连接箭头 -->
            <div v-if="i > 0" class="connector">
              <div class="line"></div>
              <div class="arrow">▼</div>
            </div>

            <div class="block-card" :class="{ genesis: block.index === 0 }">
              <div class="block-head">
                <div class="block-idx">
                  <span class="idx">#{{ block.index }}</span>
                  <span v-if="block.index === 0" class="genesis-tag">创世块</span>
                </div>
                <div class="block-ts">{{ ts(block.timestamp) }}</div>
              </div>

              <div class="block-body">
                <div class="row">
                  <span class="k">Hash</span>
                  <span class="v hash" :title="block.hash">{{ short(block.hash) }}</span>
                </div>
                <div class="row">
                  <span class="k">Prev Hash</span>
                  <span class="v hash" :title="block.previousHash">{{ block.previousHash === '0' ? '0 (创世)' : short(block.previousHash) }}</span>
                </div>
                <div class="row">
                  <span class="k">Data</span>
                  <span class="v data">{{ block.data }}</span>
                </div>
                <div class="row">
                  <span class="k">Nonce</span>
                  <span class="v mono">{{ block.nonce }}</span>
                </div>
                <div class="row">
                  <span class="k">难度</span>
                  <span class="v mono">3 个前导 0</span>
                </div>
              </div>

              <!-- 难度指示条 -->
              <div class="pow-bar">
                <div class="pow-fill" :style="{ width: Math.min((block.nonce || 0) % 10000 / 100 + '%', 100) }"></div>
              </div>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  z-index: 1;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* ===== Header ===== */
.header {
  height: 64px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky; top: 0; z-index: 10;
  backdrop-filter: blur(8px);
}
.header-left { display: flex; align-items: center; gap: 14px; }
.logo { display: flex; align-items: center; gap: 12px; }
.logo h1 { font-size: 18px; letter-spacing: 0.3px; }
.tag {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent-dim);
}
.header-right { display: flex; align-items: center; gap: 6px; }
.stat {
  display: flex; flex-direction: column; align-items: flex-start;
  padding: 4px 12px; border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  gap: 2px;
}
.stat .label { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; }
.stat .val { font-family: var(--font-mono); font-size: 13px; color: var(--text); }
.stat.highlight .val { color: var(--accent); font-weight: 600; font-size: 15px; }
.stat .dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--success);
  box-shadow: 0 0 8px var(--success);
  margin-bottom: 4px;
}
.stat.offline .dot { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
.stat.offline .label { color: var(--danger); }
.btn-refresh { padding: 8px 18px; border-color: var(--accent); color: var(--accent); font-weight: 500; }
.btn-refresh:hover { background: var(--accent-dim); }

/* ===== 主布局 ===== */
.main {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

/* ===== Sidebar ===== */
.sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex; flex-direction: column; gap: 16px;
}
.panel {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.panel h2 {
  padding: 12px 16px;
  font-size: 12px;
  letter-spacing: 1px;
  border-bottom: 1px solid var(--border);
  color: var(--text-dim);
  background: var(--bg-2);
}
.panel-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.panel-body label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; }
.full { width: 100%; padding: 10px; }
.msg { font-size: 12px; text-align: center; padding: 6px; border-radius: 4px; }
.msg.ok { background: rgba(16,185,129,0.1); color: var(--success); }
.msg.err { background: rgba(239,68,68,0.1); color: var(--danger); }
.empty { text-align: center; padding: 20px; color: var(--text-mute); font-size: 12px; }
.muted { color: var(--text-mute); font-size: 11px; text-align: center; }
.err-box { background: rgba(239,68,68,0.1); color: var(--danger); padding: 8px 14px; border-radius: 6px; font-size: 12px; }

.peer-list { display: flex; flex-direction: column; gap: 6px; }
.peer {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-2); padding: 8px 10px; border-radius: 6px;
  border: 1px solid var(--border);
  font-family: var(--font-mono); font-size: 12px;
}
.peer-idx { color: var(--text-mute); }
.peer-addr { flex: 1; color: var(--text); }
.peer-status { color: var(--success); font-size: 10px; }

.toggle {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; font-size: 12px; color: var(--text-dim);
}
.toggle input { width: auto; accent-color: var(--accent); }

/* ===== Content ===== */
.content { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.content-header { margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }

.empty-chain {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: var(--text-dim); padding: 60px;
  border: 1px dashed var(--border); border-radius: 12px;
}
.empty-icon { font-size: 48px; opacity: 0.3; }

.blocks { display: flex; flex-direction: column; gap: 0; }

/* ===== 连接箭头 ===== */
.connector {
  display: flex; flex-direction: column; align-items: center; height: 30px;
}
.connector .line { width: 2px; height: 20px; background: linear-gradient(to bottom, var(--border), var(--accent)); }
.connector .arrow { font-size: 10px; color: var(--accent); margin-top: -3px; }

/* ===== 区块卡片 ===== */
.block-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.block-card:hover {
  border-color: var(--border-glow);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(0, 229, 255, 0.05);
}
.block-card.genesis { border-color: var(--accent-dim); }
.block-card.genesis::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, var(--accent-dim) 0%, transparent 40%);
  pointer-events: none;
}

.block-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(90deg, var(--bg-2) 0%, transparent 100%);
}
.block-idx { display: flex; align-items: center; gap: 10px; }
.block-idx .idx {
  font-family: var(--font-mono); font-size: 18px; font-weight: 700;
  color: var(--accent); text-shadow: 0 0 10px var(--accent-glow);
}
.genesis-tag {
  font-size: 10px; padding: 2px 8px; border-radius: 4px;
  background: var(--accent-dim); color: var(--accent);
  border: 1px solid var(--accent);
}
.block-ts { font-family: var(--font-mono); font-size: 12px; color: var(--text-dim); }

.block-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
.row { display: grid; grid-template-columns: 90px 1fr; gap: 12px; align-items: start; }
.row .k {
  font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: 0.5px;
  padding-top: 2px;
}
.row .v { font-family: var(--font-mono); font-size: 12px; color: var(--text); word-break: break-all; }
.row .v.hash { color: var(--accent); }
.row .v.data { color: var(--accent-2); font-family: var(--font-sans); }
.row .v.mono { font-family: var(--font-mono); color: var(--text); }

.pow-bar { height: 3px; background: var(--bg-1); }
.pow-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%);
  transition: width 0.6s ease;
}

/* ===== Responsive ===== */
@media (max-width: 900px) {
  .main { flex-direction: column; }
  .sidebar { width: 100%; }
  .header-right .stat:not(.highlight) { display: none; }
}
</style>
