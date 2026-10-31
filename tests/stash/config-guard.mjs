// Stands between the tests and Stash so Stash's config lock cannot deadlock.
// Stash (v0.30.0 to v0.31.1, and develop) takes its config read lock twice in
// GetSFWContentMode: once itself and again in the getBool it calls. Go's
// RWMutex lets no new reader in once a writer waits, so a config write that
// queues between those two read locks waits for the first one, the second
// one waits for the write, and every request after them waits behind it:
// Stash stops answering for good. Two paths reach GetSFWContentMode: a
// performer's image when the performer has none, and every `configuration`
// query, whatever it selects. The writes are the mutations below,
// configurePlugin among them.
//
// This proxy lets a config write into Stash only while none of those reads
// is in it, and holds the reads while a write is in, first come first
// served. Everything else passes straight through, websockets included, with
// the Host header kept, so the URLs Stash builds still point here. Plugin
// backends that call Stash themselves (New Releases' Python task) use the
// port Stash listens on and pass by it.
//
// stash.sh starts it: `node tests/stash/config-guard.mjs <port> <stash port>
// <stash pid>`, and it exits when Stash does. It logs each write it held back
// while reads were in Stash, the moment the deadlock could have struck, with
// the reads it waits for.
import { Agent, createServer, request } from 'node:http'
import { connect } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The mutations that take the config write lock (Config.Set* and Write in
// Stash's internal/api/resolver_mutation_*.go)
const WRITE =
  /\b(?:configure[A-Z]\w*|generateAPIKey|setPluginsEnabled|setDefaultFilter|setup)\s*\(/

// 'write', 'read' (reaches GetSFWContentMode) or null (neither).
export function kindOf(method, url, body = '') {
  if (method === 'GET' && /^\/performer\/\d+\/image(?:[?/]|$)/.test(url))
    return 'read'
  if (method !== 'POST' || !/^\/graphql(?:[?/]|$)/.test(url)) return null
  const text = String(body)
  if (/\bmutation\b/.test(text) && WRITE.test(text)) return 'write'
  return /\bconfiguration\b/.test(text) ? 'read' : null
}

// A first-come-first-served read/write lock: reads share it, a write has it
// alone, and a waiting write holds back the reads that came after it.
export class Gate {
  #reads = 0
  #writing = false
  #queue = []

  get reads() {
    return this.#reads
  }

  enter(kind) {
    return new Promise((go) => {
      this.#queue.push({ kind, go })
      this.#pump()
    })
  }

  leave(kind) {
    if (kind === 'write') this.#writing = false
    else this.#reads--
    this.#pump()
  }

  #pump() {
    while (this.#queue.length) {
      const { kind, go } = this.#queue[0]
      if (this.#writing || (kind === 'write' && this.#reads)) return
      this.#queue.shift()
      if (kind === 'write') this.#writing = true
      else this.#reads++
      go()
    }
  }
}

const HOP = new Set(['connection', 'keep-alive', 'transfer-encoding'])
const endToEnd = (raw) =>
  raw.flatMap((v, i) =>
    i % 2 || HOP.has(v.toLowerCase()) ? [] : [v, raw[i + 1]],
  )

const collect = (req) =>
  new Promise((done, fail) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => done(Buffer.concat(chunks)))
    req.on('error', fail)
  })

// How the log names a guarded request: its path, and a GraphQL operation's
// name when it has one
function nameOf(req, body) {
  let op
  try {
    op = JSON.parse(body).operationName
  } catch {
    // Not JSON, or no body
  }
  return `${req.method} ${req.url}${op ? ` ${op}` : ''}`
}

const age = (read) =>
  `${read.name} (${((Date.now() - read.at) / 1000).toFixed(1)} s${read.gone ? ', its client gone' : ''})`

export function createGuard({ target, log = () => {} }) {
  const gate = new Gate()
  const agent = new Agent({ keepAlive: true })
  // The reads in Stash, which the log names when a write waits for them
  const inside = new Set()

  const server = createServer(async (req, res) => {
    // A GraphQL body is read whole to tell a config write or read apart
    let body
    if (req.method === 'POST' && /^\/graphql(?:[?/]|$)/.test(req.url)) {
      try {
        body = await collect(req)
      } catch {
        return res.destroy()
      }
    }
    const kind = kindOf(req.method, req.url, body)
    if (kind === 'write' && gate.reads)
      log(
        `held a write for ${gate.reads} read(s) in Stash: ${[...inside].map(age).join(', ')}`,
      )
    if (kind) await gate.enter(kind)
    const read = kind === 'read' && { name: nameOf(req, body), at: Date.now() }
    if (read) {
      inside.add(read)
      res.on('close', () => {
        if (!res.writableFinished) read.gone = true
      })
    }

    let left = false
    const leave = () => {
      if (kind && !left) {
        left = true
        inside.delete(read)
        gate.leave(kind)
      }
    }
    const up = request({
      host: '127.0.0.1',
      port: target,
      method: req.method,
      path: req.url,
      headers: req.headers,
      agent,
    })
    let answer
    up.on('response', (stash) => {
      answer = stash
      // A guarded request leaves the gate when Stash has answered, which is
      // after its handler let go of the lock
      stash.on('end', leave)
      stash.on('close', leave)
      if (res.destroyed) return stash.resume()
      res.writeHead(
        stash.statusCode,
        stash.statusMessage,
        endToEnd(stash.rawHeaders),
      )
      stash.pipe(res)
    })
    up.on('error', () => {
      leave()
      if (!res.headersSent) res.writeHead(502).end()
      else res.destroy()
    })
    res.on('close', () => {
      if (res.writableFinished) return
      // A guarded request runs to the end in Stash even when the browser
      // gives up on it, since Stash's handler may still hold the lock. Its
      // answer leaves the pipe first: pipe()'s own close handler, after this
      // one, would pause it again, and it would never end
      if (kind) answer?.unpipe(res).resume()
      else up.destroy()
    })
    if (body) up.end(body)
    else req.pipe(up)
  })

  // Websockets (GraphQL subscriptions) go straight through
  server.on('upgrade', (req, socket, head) => {
    const up = connect(target, '127.0.0.1', () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`]
      for (let i = 0; i < req.rawHeaders.length; i += 2)
        lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`)
      up.write(`${lines.join('\r\n')}\r\n\r\n`)
      if (head.length) up.write(head)
      socket.pipe(up).pipe(socket)
    })
    up.on('error', () => socket.destroy())
    socket.on('error', () => up.destroy())
  })

  return server
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [port, target, pid] = process.argv.slice(2).map(Number)
  const log = (line) => console.log(`${new Date().toISOString()} ${line}`)
  createGuard({ target, log }).listen(port, '127.0.0.1', () =>
    log(`guarding Stash on ${target} at ${port}`),
  )
  setInterval(() => {
    try {
      process.kill(pid, 0)
    } catch {
      process.exit(0)
    }
  }, 1000)
}
