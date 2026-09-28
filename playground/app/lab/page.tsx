// The bake-off lobby: four skins of the same world, one link each.
// Scores and round-by-round screenshots live on the board (`make lab-board`).
const SKINS = [
  { id: "paper", name: "Papercraft", pitch: "A cut-paper overworld with real card depth: regions as stitched fabric islands, roads in gold, set-pieces that pop up when you zoom in." },
  { id: "pixel", name: "16-bit", pitch: "A console-era tile map: autotiled coasts, animated water, a walking sprite and a status screen for every model." },
  { id: "hybrid", name: "Paper and pixels", pitch: "The papercraft map with RPG dialog boxes for everything you read." },
  { id: "flow", name: "Kawaii flow", pitch: "Models as little creatures on a dataflow board; select one and tensors parade in from its ancestors." },
];

export default function LabIndex() {
  return (
    <main className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-6 overflow-y-auto px-4 py-10">
      <h1 className="text-3xl font-bold">Four ways to see the zoo</h1>
      <p className="max-w-prose text-neutral-600">
        Same 44 models, same map geometry, four designs. Open each, click around, then pick the one that should become the playground.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SKINS.map((s) => (
          <li key={s.id}>
            <a href={`/lab/${s.id}/`} className="block h-full rounded-lg border border-neutral-300 p-4 hover:border-neutral-900 focus-visible:outline-2">
              <span className="text-lg font-semibold">{s.name}</span>
              <span className="mt-1 block text-[15px] text-neutral-600">{s.pitch}</span>
            </a>
          </li>
        ))}
      </ul>
      <nav className="flex gap-4 text-sm text-neutral-500">
        <a className="underline" href="/lab/stub/">Reference stub</a>
        <a className="underline" href="/">Classic playground</a>
      </nav>
    </main>
  );
}
