#!/usr/bin/env node
// One address per UI: a single tiny process that listens on one port per
// playground UI and opens straight on it. Every other path (pages, /_next
// assets, the HMR websocket) passes through to the one Next dev server, so
// each port always shows the latest work and costs ~nothing.
//
//   node scripts/ports.mjs            # needs `make playground-dev` on :3000
//   node scripts/ports.mjs --list     # print the table and exit
//
// Bound to 0.0.0.0 so a phone on the same network can open
// http://<lan-ip>:<port>/ (the API's dev CORS accepts private-network origins).
import http from "node:http";
import net from "node:net";
import os from "node:os";

const TARGET = { host: "127.0.0.1", port: Number(process.env.PORTS_TARGET ?? 3000) };

export const UIS = [
  { port: 3001, name: "Pixel map", path: "/lab/painted/?map=pixel" },
  { port: 3002, name: "Paper map", path: "/lab/painted/?map=paper" },
  { port: 3003, name: "Star atlas", path: "/lab/sky/" },
  { port: 3004, name: "Kawaii flow", path: "/lab/flow/" },
  { port: 3005, name: "Transit layout", path: "/?edition=metro" },
  { port: 3006, name: "Periodic table — blueprint", path: "/?edition=blueprint" },
  { port: 3007, name: "Periodic table — wall chart", path: "/?edition=wallchart" },
  { port: 3008, name: "Periodic table — terminal", path: "/?edition=terminal" },
  { port: 3009, name: "Diagram specimens", path: "/lab/anatomy/?variant=card" },
  { port: 3010, name: "Design board", path: "/lab/designs/" },
];

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  return null;
}

function printTable() {
  const ip = lanIp();
  for (const u of UIS) {
    console.log(`${String(u.port).padEnd(5)} ${u.name.padEnd(28)} http://localhost:${u.port}/${ip ? `   http://${ip}:${u.port}/` : ""}`);
  }
}

if (process.argv.includes("--list")) { printTable(); process.exit(0); }

for (const ui of UIS) {
  const server = http.createServer((req, res) => {
    // a bare address (or the UI's own root) lands on the UI
    if (req.url === "/" || req.url === "") {
      res.writeHead(302, { location: ui.path, "cache-control": "no-store" });
      res.end();
      return;
    }
    const up = http.request(
      { ...TARGET, method: req.method, path: req.url, headers: { ...req.headers, host: `${TARGET.host}:${TARGET.port}` } },
      (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); },
    );
    up.on("error", (e) => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
      res.end(`The playground dev server on :${TARGET.port} is not answering (${e.code}). Start it with \`make playground-dev\`.`);
    });
    req.pipe(up);
  });
  // websockets (Next's hot reload): replay the upgrade request and splice the sockets
  server.on("upgrade", (req, socket, head) => {
    const up = net.connect(TARGET.port, TARGET.host, () => {
      const headers = { ...req.headers, host: `${TARGET.host}:${TARGET.port}` };
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), "", ""];
      up.write(lines.join("\r\n"));
      if (head?.length) up.write(head);
      up.pipe(socket);
      socket.pipe(up);
    });
    const close = () => { socket.destroy(); up.destroy(); };
    up.on("error", close);
    socket.on("error", close);
  });
  server.on("error", (e) => console.error(`:${ui.port} ${ui.name}: ${e.code === "EADDRINUSE" ? "port already in use" : e.message}`));
  server.listen(ui.port, "0.0.0.0");
}
printTable();
