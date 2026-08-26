import { mulberry32, pick, pickN, randInt } from './rng';

// ---------------------------------------------------------------------
// Each language exports a single `SampleGenerator` built from 2+ private
// variant functions (`xxxA`, `xxxB`, ...) combined with `variantOf`, e.g.:
//
//   const rubyA: SampleGenerator = (seed) => { const p = pools(seed); return `...`; };
//   const rubyB: SampleGenerator = (seed) => { const p = pools(seed); return `...`; };
//   export const ruby: SampleGenerator = (seed) => variantOf(seed, [rubyA, rubyB]);
//
// Variants should use genuinely different language constructs (a class vs.
// an enum/switch vs. a generic function, etc.) — the whole point is that
// regenerating exercises different TextMate scopes, not just new variable
// names inside the same shape. `pools(seed)` gives deterministic-per-seed
// identifier/value filler shared across variants; add to it if a new
// variant needs a kind of value none of the existing ones use.
// ---------------------------------------------------------------------

const ENTITY_NAMES = ['User', 'Order', 'Invoice', 'Session', 'Widget', 'Account'] as const;
// Excludes "id" — every template already declares its own dedicated id field,
// so including it here risked generating a duplicate/colliding column or property.
const FIELD_NAMES = ['name', 'status', 'createdAt', 'total', 'ownerId'] as const;
const VERBS = ['fetch', 'create', 'update', 'archive', 'validate', 'sync'] as const;
const WORDS = ['pending', 'active', 'archived', 'draft', 'closed'] as const;

interface SeedPools {
  entity: string;
  entityLower: string;
  field: string;
  field2: string;
  verb: string;
  word: string;
  count: number;
}

function pools(seed: number): SeedPools {
  const rng = mulberry32(seed);
  const entity = pick(rng, ENTITY_NAMES);
  const [field, field2] = pickN(rng, FIELD_NAMES, 2);
  return {
    entity,
    entityLower: entity[0].toLowerCase() + entity.slice(1),
    field,
    field2,
    verb: pick(rng, VERBS),
    word: pick(rng, WORDS),
    count: randInt(rng, 3, 25),
  };
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

export type SampleGenerator = (seed: number) => string;

/** Picks between structurally distinct variants so regenerating exercises
 * genuinely different keywords/constructs, not just new identifier names. */
function variantOf(seed: number, variants: SampleGenerator[]): string {
  const generator = variants[Math.abs(seed) % variants.length];
  return generator(seed);
}

// ---------- TypeScript ----------

const typescriptA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `import { EventEmitter } from "node:events";

interface ${p.entity}Record {
  id: number;
  ${p.field}: string;
  tags: readonly string[];
}

/** Tracks ${p.entityLower} records and notifies subscribers. */
class ${p.entity}Registry extends EventEmitter {
  private readonly items = new Map<number, ${p.entity}Record>();
  #internalToken: string = "unset";

  constructor(private readonly maxItems: number = ${p.count}) {
    super();
  }

  ${p.verb}(record: ${p.entity}Record): boolean {
    if (this.items.size >= this.maxItems) {
      console.warn(\`Registry full, rejecting \${record.${p.field}}\`);
      return false;
    }
    this.items.set(record.id, record);
    this.emit("${p.word}", record);
    return true;
  }

  findByStatus(status: string): ${p.entity}Record[] {
    return [...this.items.values()].filter((r) => r.${p.field} === status);
  }
}

const registry = new ${p.entity}Registry(${p.count});
registry.${p.verb}({ id: 1, ${p.field}: "${p.word}", tags: ["a", "b"] });

export default registry;
`;
};

const typescriptB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `enum ${p.entity}Status {
  Pending = "pending",
  Active = "active",
  Archived = "archived",
}

interface ${p.entity}<T = unknown> {
  id: number;
  status: ${p.entity}Status;
  payload?: T;
}

async function ${p.verb}${p.entity}(id: number): Promise<${p.entity} | null> {
  try {
    const response = await fetch(\`/api/${p.entityLower}/\${id}\`);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    return (await response.json()) as ${p.entity};
  } catch (err) {
    console.error("failed to ${p.verb}:", err);
    return null;
  }
}

function describe(item: ${p.entity}): string {
  switch (item.status) {
    case ${p.entity}Status.Pending:
      return "waiting";
    case ${p.entity}Status.Active:
      return "in progress";
    default:
      return "done";
  }
}

const items: ${p.entity}[] = Array.from({ length: ${p.count} }, (_, i) => ({
  id: i,
  status: ${p.entity}Status.Active,
}));

const summary = items
  .filter((i) => i.status !== ${p.entity}Status.Archived)
  .map((i) => \`#\${i.id}: \${describe(i)}\`)
  .join(", ");

console.log(summary ?? "none");
`;
};

const typescriptC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `type ${p.entity}Event =
  | { kind: "${p.word}"; id: number; ${p.field}?: string }
  | { kind: "removed"; id: number };

function is${p.entity}Removed(event: ${p.entity}Event): event is Extract<${p.entity}Event, { kind: "removed" }> {
  return event.kind === "removed";
}

type Readonly${p.entity} = Readonly<{ id: number; ${p.field}: string }>;

class ${p.entity}Bus {
  private listeners: Array<(event: ${p.entity}Event) => void> = [];

  on(listener: (event: ${p.entity}Event) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  ${p.verb}(event: ${p.entity}Event): void {
    for (const listener of this.listeners) listener(event);
  }
}

const bus = new ${p.entity}Bus();
const unsubscribe = bus.on((event) => {
  const label = is${p.entity}Removed(event) ? "removed" : event.${p.field} ?? "${p.word}";
  console.log(\`#\${event.id}: \${label}\`);
});

bus.${p.verb}({ kind: "${p.word}", id: 1, ${p.field}: "${p.word}" });
unsubscribe();
`;
};

export const typescript: SampleGenerator = (seed) => variantOf(seed, [typescriptA, typescriptB, typescriptC]);

// ---------- JavaScript ----------

const javascriptA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `const EventEmitter = require("node:events");

/**
 * Tracks ${p.entityLower} records in memory.
 */
class ${p.entity}Registry extends EventEmitter {
  constructor(maxItems = ${p.count}) {
    super();
    this.maxItems = maxItems;
    this.items = new Map();
  }

  ${p.verb}(record) {
    if (this.items.size >= this.maxItems) {
      console.warn(\`Registry full, rejecting #\${record.id}\`);
      return false;
    }
    this.items.set(record.id, { ...record, ${p.field}: record.${p.field} ?? "${p.word}" });
    this.emit("changed", record);
    return true;
  }

  get count() {
    return this.items.size;
  }
}

const registry = new ${p.entity}Registry();
for (let i = 0; i < 3; i++) {
  registry.${p.verb}({ id: i, ${p.field}: "${p.word}" });
}

module.exports = registry;
`;
};

const javascriptB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_${p.word.toUpperCase()}_LIMIT = ${p.count};

async function ${p.verb}All(${p.entityLower}s) {
  const results = [];
  for (const item of ${p.entityLower}s) {
    try {
      await delay(10);
      results.push({ ...item, ${p.field}: item.${p.field} ?? "${p.word}" });
    } catch (err) {
      console.error(\`could not ${p.verb} \${item.id}:\`, err.message);
    }
  }
  return results;
}

const pattern = /^[a-z0-9_-]+$/i;

function isValidSlug(value) {
  return typeof value === "string" && pattern.test(value);
}

const ${p.entityLower}s = Array.from({ length: DEFAULT_${p.word.toUpperCase()}_LIMIT }, (_, id) => ({
  id,
  ${p.field}: id % 2 === 0 ? "${p.word}" : null,
}));

${p.verb}All(${p.entityLower}s).then((done) => {
  console.log(\`${p.verb}ed \${done.length} ${p.entityLower}(s)\`);
});
`;
};

const javascriptC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `function* ${p.verb}Batches(items, size = 3) {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}

function highlight(strings, ...values) {
  return strings.reduce((acc, str, i) => \`\${acc}\${str}\${values[i] ?? ""}\`, "");
}

function make${p.entity}Counter() {
  let ${p.entityLower}Count = 0;
  return {
    ${p.verb}: () => ++${p.entityLower}Count,
    get total() {
      return ${p.entityLower}Count;
    },
  };
}

const counter = make${p.entity}Counter();
const items = Array.from({ length: ${p.count} }, (_, id) => ({ id, ${p.field}: "${p.word}" }));

for (const batch of ${p.verb}Batches(items)) {
  counter.${p.verb}();
  console.log(highlight\`batch of \${batch.length} item(s)\`);
}

console.log(\`processed \${counter.total} batch(es)\`);
`;
};

export const javascript: SampleGenerator = (seed) => variantOf(seed, [javascriptA, javascriptB, javascriptC]);

// ---------- Python ----------

const pythonA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `from dataclasses import dataclass, field
from typing import Optional
import json


@dataclass
class ${p.entity}:
    id: int
    ${p.field}: str = "${p.word}"
    tags: list[str] = field(default_factory=list)

    def is_${p.word}(self) -> bool:
        return self.${p.field} == "${p.word}"


class ${p.entity}Registry:
    """Tracks ${p.entityLower} records and supports lookup by field."""

    def __init__(self, max_items: int = ${p.count}) -> None:
        self._items: dict[int, ${p.entity}] = {}
        self.max_items = max_items

    def ${p.verb}(self, item: ${p.entity}) -> bool:
        if len(self._items) >= self.max_items:
            print(f"registry full, rejecting {item.id}")
            return False
        self._items[item.id] = item
        return True

    def find(self, ${p.field}: str) -> Optional[${p.entity}]:
        return next((i for i in self._items.values() if i.${p.field} == ${p.field}), None)


if __name__ == "__main__":
    registry = ${p.entity}Registry()
    registry.${p.verb}(${p.entity}(id=1, ${p.field}="${p.word}"))
    print(json.dumps({"count": len(registry._items)}))
`;
};

const pythonB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `from contextlib import contextmanager
from enum import Enum
from functools import lru_cache


class ${p.entity}Status(Enum):
    PENDING = "pending"
    ACTIVE = "active"
    ARCHIVED = "archived"


@contextmanager
def ${p.verb}_session(${p.entityLower}_id: int):
    print(f"opening session for {${p.entityLower}_id}")
    try:
        yield {"id": ${p.entityLower}_id, "status": ${p.entity}Status.ACTIVE}
    except ValueError as exc:
        print(f"session error: {exc}")
        raise
    finally:
        print("closing session")


@lru_cache(maxsize=${p.count})
def describe(status: ${p.entity}Status) -> str:
    labels = {
        ${p.entity}Status.PENDING: "waiting",
        ${p.entity}Status.ACTIVE: "in progress",
        ${p.entity}Status.ARCHIVED: "done",
    }
    return labels.get(status, "unknown")


def ${p.entityLower}_batches(items: list[dict], size: int = 3):
    for i in range(0, len(items), size):
        yield items[i : i + size]


with ${p.verb}_session(1) as session:
    print(f"{session['id']} -> {describe(session['status'])}")

items = [{"id": i, "${p.field}": "${p.word}"} for i in range(${p.count})]
batches = list(${p.entityLower}_batches(items))
print(f"{len(batches)} batch(es) ready")
`;
};

const pythonC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `import asyncio
from typing import Protocol


class ${p.entity}Source(Protocol):
    async def ${p.verb}(self, id: int) -> dict: ...


def rate_limited(max_calls: int):
    def decorator(func):
        calls = 0

        async def wrapper(*args, **kwargs):
            nonlocal calls
            if calls >= max_calls:
                raise RuntimeError("rate limit exceeded")
            calls += 1
            return await func(*args, **kwargs)

        return wrapper

    return decorator


@rate_limited(max_calls=${p.count})
async def ${p.verb}_${p.entityLower}(id: int) -> dict:
    await asyncio.sleep(0)
    return {"id": id, "${p.field}": "${p.word}"}


async def main() -> None:
    results = [await ${p.verb}_${p.entityLower}(i) for i in range(3)]

    for item in results:
        match item:
            case {"${p.field}": "${p.word}", "id": id}:
                print(f"{id}: matched ${p.word}")
            case _:
                print("no match")


asyncio.run(main())
`;
};

export const python: SampleGenerator = (seed) => variantOf(seed, [pythonA, pythonB, pythonC]);

// ---------- Java ----------

const javaA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `package com.example.registry;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class ${p.entity}Registry {
    private final Map<Integer, ${p.entity}> items = new HashMap<>();
    private final int maxItems;

    public ${p.entity}Registry(int maxItems) {
        this.maxItems = maxItems;
    }

    public boolean ${p.verb}(${p.entity} record) {
        if (items.size() >= maxItems) {
            System.out.println("registry full, rejecting " + record.getId());
            return false;
        }
        items.put(record.getId(), record);
        return true;
    }

    public Optional<${p.entity}> findById(int id) {
        return Optional.ofNullable(items.get(id));
    }

    public static void main(String[] args) {
        ${p.entity}Registry registry = new ${p.entity}Registry(${p.count});
        registry.${p.verb}(new ${p.entity}(1, "${p.word}"));
        System.out.printf("count=%d%n", registry.items.size());
    }
}
`;
};

const javaB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `package com.example.registry;

import java.util.List;
import java.util.stream.Collectors;

public interface ${p.entity}Source {
    List<${p.entity}> ${p.verb}All();

    enum Status {
        PENDING, ACTIVE, ARCHIVED;

        String describe() {
            return switch (this) {
                case PENDING -> "waiting";
                case ACTIVE -> "in progress";
                case ARCHIVED -> "done";
            };
        }
    }
}

class Default${p.entity}Source implements ${p.entity}Source {
    @Override
    public List<${p.entity}> ${p.verb}All() {
        try (var scope = new AutoCloseable() {
            public void close() { System.out.println("closing ${p.entityLower} source"); }
        }) {
            return List.of();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public String summarize(List<${p.entity}> items) {
        return items.stream()
            .filter(i -> i.get${cap(p.field)}() != null)
            .map(i -> "#" + i.getId())
            .collect(Collectors.joining(", ", "[", "]"));
    }
}
`;
};

const javaC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `package com.example.registry;

import java.util.List;
import java.util.function.Predicate;

public sealed interface ${p.entity}Event permits ${p.entity}Created, ${p.entity}Removed {
}

public record ${p.entity}Created(int id, String ${p.field}) implements ${p.entity}Event {
}

public record ${p.entity}Removed(int id) implements ${p.entity}Event {
}

public final class ${p.entity}EventLog {
    private final List<${p.entity}Event> events = new java.util.ArrayList<>();

    public void ${p.verb}(${p.entity}Event event) {
        events.add(event);
    }

    public String describe(${p.entity}Event event) {
        return switch (event) {
            case ${p.entity}Created c -> "created #" + c.id() + " (" + c.${p.field}() + ")";
            case ${p.entity}Removed r -> "removed #" + r.id();
        };
    }

    public long countMatching(Predicate<${p.entity}Event> predicate) {
        return events.stream().filter(predicate).count();
    }

    public static void main(String[] args) {
        var log = new ${p.entity}EventLog();
        log.${p.verb}(new ${p.entity}Created(1, "${p.word}"));
        log.${p.verb}(new ${p.entity}Removed(1));

        for (var event : log.events) {
            System.out.println(log.describe(event));
        }
    }
}
`;
};

export const java: SampleGenerator = (seed) => variantOf(seed, [javaA, javaB, javaC]);

// ---------- C# ----------

const csharpA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `using System;
using System.Collections.Generic;
using System.Linq;

namespace Example.Registry;

public record ${p.entity}(int Id, string ${cap(p.field)} = "${p.word}");

public class ${p.entity}Registry
{
    private readonly Dictionary<int, ${p.entity}> _items = new();
    private readonly int _maxItems;

    public ${p.entity}Registry(int maxItems = ${p.count})
    {
        _maxItems = maxItems;
    }

    public bool ${cap(p.verb)}(${p.entity} item)
    {
        if (_items.Count >= _maxItems)
        {
            Console.WriteLine($"registry full, rejecting {item.Id}");
            return false;
        }
        _items[item.Id] = item;
        return true;
    }

    public IEnumerable<${p.entity}> Active =>
        _items.Values.Where(i => i.${cap(p.field)} == "${p.word}");
}
`;
};

const csharpB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `using System;
using System.Linq;
using System.Threading.Tasks;

namespace Example.Registry;

public enum ${p.entity}Status
{
    Pending,
    Active,
    Archived,
}

public interface I${p.entity}Repository
{
    Task<${p.entity}Status> ${cap(p.verb)}Async(int id);
}

public class ${p.entity}Repository : I${p.entity}Repository
{
    public async Task<${p.entity}Status> ${cap(p.verb)}Async(int id)
    {
        await Task.Delay(10);
        return id % 2 == 0 ? ${p.entity}Status.Active : ${p.entity}Status.Pending;
    }

    public static string Describe(${p.entity}Status status) => status switch
    {
        ${p.entity}Status.Pending => "waiting",
        ${p.entity}Status.Active => "in progress",
        _ => "done",
    };
}

var repo = new ${p.entity}Repository();
var ids = Enumerable.Range(1, ${p.count});
foreach (var id in ids.Where(i => i % 3 != 0))
{
    var status = await repo.${cap(p.verb)}Async(id);
    Console.WriteLine($"{id}: {${p.entity}Repository.Describe(status)}");
}
`;
};

const csharpC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `using System;
using System.Collections.Generic;
using System.Linq;

namespace Example.Registry;

[AttributeUsage(AttributeTargets.Class)]
public sealed class ${p.entity}TagAttribute : Attribute
{
    public string Label { get; }
    public ${p.entity}TagAttribute(string label) => Label = label;
}

public abstract record ${p.entity}Event(int Id);
public sealed record ${p.entity}Created(int Id, string ${cap(p.field)}) : ${p.entity}Event(Id);
public sealed record ${p.entity}Removed(int Id) : ${p.entity}Event(Id);

[${p.entity}Tag("${p.word}")]
public static class ${p.entity}EventExtensions
{
    public static string Describe(this ${p.entity}Event @event) => @event switch
    {
        ${p.entity}Created c => $"created #{c.Id} ({c.${cap(p.field)}})",
        ${p.entity}Removed r => $"removed #{r.Id}",
        _ => "unknown",
    };
}

var events = new List<${p.entity}Event>
{
    new ${p.entity}Created(1, "${p.word}"),
    new ${p.entity}Removed(2),
};

var summary =
    from e in events
    where e is ${p.entity}Created
    select e.Describe();

foreach (var line in summary.Take(${p.count}))
{
    Console.WriteLine(line);
}
`;
};

export const csharp: SampleGenerator = (seed) => variantOf(seed, [csharpA, csharpB, csharpC]);

// ---------- C++ ----------

const cppA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `#include <memory>
#include <string>
#include <unordered_map>
#include <optional>

namespace registry {

struct ${p.entity} {
    int id;
    std::string ${p.field} = "${p.word}";
};

class ${p.entity}Registry {
public:
    explicit ${p.entity}Registry(std::size_t max_items = ${p.count})
        : max_items_(max_items) {}

    bool ${p.verb}(const ${p.entity}& item) {
        if (items_.size() >= max_items_) {
            return false;
        }
        items_.emplace(item.id, item);
        return true;
    }

    std::optional<${p.entity}> find(int id) const {
        auto it = items_.find(id);
        if (it == items_.end()) return std::nullopt;
        return it->second;
    }

private:
    std::unordered_map<int, ${p.entity}> items_;
    std::size_t max_items_;
};

}  // namespace registry
`;
};

const cppB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `#include <vector>
#include <algorithm>
#include <iostream>
#include <memory>

namespace registry {

enum class Status { Pending, Active, Archived };

template <typename T>
class Repository {
public:
    void ${p.verb}(std::unique_ptr<T> item) {
        items_.push_back(std::move(item));
    }

    template <typename Predicate>
    std::vector<T*> where(Predicate pred) const {
        std::vector<T*> out;
        for (const auto& item : items_) {
            if (pred(*item)) out.push_back(item.get());
        }
        return out;
    }

    std::size_t size() const { return items_.size(); }

private:
    std::vector<std::unique_ptr<T>> items_;
};

struct ${p.entity} {
    int id;
    Status status = Status::Pending;
};

}  // namespace registry

int main() {
    registry::Repository<registry::${p.entity}> repo;
    for (int i = 0; i < ${p.count}; ++i) {
        auto item = std::make_unique<registry::${p.entity}>();
        item->id = i;
        item->status = (i % 2 == 0) ? registry::Status::Active : registry::Status::Pending;
        repo.${p.verb}(std::move(item));
    }

    auto active = repo.where([](const registry::${p.entity}& r) {
        return r.status == registry::Status::Active;
    });
    std::cout << active.size() << " active of " << repo.size() << "\\n";
}
`;
};

const cppC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `#include <functional>
#include <string>
#include <variant>
#include <vector>
#include <iostream>

namespace registry {

constexpr int kDefaultCapacity = ${p.count};

struct Created { int id; std::string ${p.field}; };
struct Removed { int id; };
using Event = std::variant<Created, Removed>;

class EventLog {
public:
    void ${p.verb}(Event event) {
        events_.push_back(std::move(event));
        if (on_${p.verb}_) on_${p.verb}_(events_.back());
    }

    void on_event(std::function<void(const Event&)> callback) {
        on_${p.verb}_ = std::move(callback);
    }

    std::size_t size() const noexcept { return events_.size(); }

private:
    std::vector<Event> events_;
    std::function<void(const Event&)> on_${p.verb}_;
};

std::string describe(const Event& event) {
    return std::visit([](const auto& e) -> std::string {
        using T = std::decay_t<decltype(e)>;
        if constexpr (std::is_same_v<T, Created>) {
            return "created #" + std::to_string(e.id) + " (" + e.${p.field} + ")";
        } else {
            return "removed #" + std::to_string(e.id);
        }
    }, event);
}

}  // namespace registry

int main() {
    registry::EventLog log;
    log.on_event([](const registry::Event& e) {
        std::cout << registry::describe(e) << "\\n";
    });

    log.${p.verb}(registry::Created{1, "${p.word}"});
    log.${p.verb}(registry::Removed{1});

    std::cout << log.size() << " of " << registry::kDefaultCapacity << " capacity used\\n";
}
`;
};

export const cpp: SampleGenerator = (seed) => variantOf(seed, [cppA, cppB, cppC]);

// ---------- Go ----------

const goA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `package registry

import (
	"errors"
	"fmt"
)

// ${p.entity} represents a single tracked record.
type ${p.entity} struct {
	ID     int
	${cap(p.field)} string
}

// Registry tracks ${p.entityLower} records up to a maximum size.
type Registry struct {
	items    map[int]${p.entity}
	maxItems int
}

func New${p.entity}Registry(maxItems int) *Registry {
	return &Registry{items: make(map[int]${p.entity}), maxItems: maxItems}
}

func (r *Registry) ${cap(p.verb)}(item ${p.entity}) error {
	if len(r.items) >= r.maxItems {
		return errors.New("registry full")
	}
	r.items[item.ID] = item
	return nil
}

func main() {
	r := New${p.entity}Registry(${p.count})
	if err := r.${cap(p.verb)}(${p.entity}{ID: 1, ${cap(p.field)}: "${p.word}"}); err != nil {
		fmt.Println("error:", err)
	}
}
`;
};

const goB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `package registry

import (
	"fmt"
	"sync"
)

type Status int

const (
	Pending Status = iota
	Active
	Archived
)

func (s Status) String() string {
	switch s {
	case Pending:
		return "waiting"
	case Active:
		return "in progress"
	default:
		return "done"
	}
}

type Watcher interface {
	Notify(id int, status Status)
}

type ${p.entity}Store struct {
	mu       sync.Mutex
	watchers []Watcher
}

func (s *${p.entity}Store) ${cap(p.verb)}(ids <-chan int, results chan<- Status) {
	defer close(results)
	for id := range ids {
		s.mu.Lock()
		status := Active
		if id%2 == 0 {
			status = Pending
		}
		s.mu.Unlock()
		for _, w := range s.watchers {
			w.Notify(id, status)
		}
		results <- status
	}
}

func main() {
	ids := make(chan int, ${p.count})
	results := make(chan Status, ${p.count})
	store := &${p.entity}Store{}

	go store.${cap(p.verb)}(ids, results)

	for i := 0; i < ${p.count}; i++ {
		ids <- i
	}
	close(ids)

	for status := range results {
		fmt.Println(status)
	}
}
`;
};

const goC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `package registry

import (
	"context"
	"fmt"
	"time"
)

type Identifiable interface {
	GetID() int
}

type ${p.entity} struct {
	ID     int
	${cap(p.field)} string
}

func (r ${p.entity}) GetID() int { return r.ID }

type Base struct {
	CreatedAt time.Time
}

type Tracked${p.entity} struct {
	Base
	${p.entity}
}

func Filter[T Identifiable](items []T, keep func(T) bool) []T {
	out := make([]T, 0, len(items))
	for _, item := range items {
		if keep(item) {
			out = append(out, item)
		}
	}
	return out
}

func ${cap(p.verb)}WithTimeout(ctx context.Context, id int) (${p.entity}, error) {
	ctx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
	defer cancel()

	select {
	case <-ctx.Done():
		return ${p.entity}{}, ctx.Err()
	default:
		return ${p.entity}{ID: id, ${cap(p.field)}: "${p.word}"}, nil
	}
}

func main() {
	items := make([]${p.entity}, 0, ${p.count})
	for i := 0; i < ${p.count}; i++ {
		items = append(items, ${p.entity}{ID: i, ${cap(p.field)}: "${p.word}"})
	}

	active := Filter(items, func(r ${p.entity}) bool { return r.ID%2 == 0 })
	fmt.Printf("%d of %d active\\n", len(active), len(items))

	tracked := Tracked${p.entity}{Base: Base{CreatedAt: time.Now()}, ${p.entity}: items[0]}
	fmt.Println(tracked.GetID())
}
`;
};

export const go: SampleGenerator = (seed) => variantOf(seed, [goA, goB, goC]);

// ---------- Rust ----------

const rustA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ${p.entity} {
    pub id: u32,
    pub ${p.field}: String,
}

pub struct Registry {
    items: HashMap<u32, ${p.entity}>,
    max_items: usize,
}

impl Registry {
    pub fn new(max_items: usize) -> Self {
        Self { items: HashMap::new(), max_items }
    }

    pub fn ${p.verb}(&mut self, item: ${p.entity}) -> Result<(), &'static str> {
        if self.items.len() >= self.max_items {
            return Err("registry full");
        }
        self.items.insert(item.id, item);
        Ok(())
    }

    pub fn find(&self, id: u32) -> Option<&${p.entity}> {
        self.items.get(&id)
    }
}

fn main() {
    let mut registry = Registry::new(${p.count});
    let item = ${p.entity} { id: 1, ${p.field}: "${p.word}".to_string() };
    match registry.${p.verb}(item) {
        Ok(()) => println!("added"),
        Err(e) => eprintln!("failed: {e}"),
    }
}
`;
};

const rustB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `#[derive(Debug, PartialEq)]
enum Status {
    Pending,
    Active,
    Archived,
}

trait Describe {
    fn describe(&self) -> &'static str;
}

impl Describe for Status {
    fn describe(&self) -> &'static str {
        match self {
            Status::Pending => "waiting",
            Status::Active => "in progress",
            Status::Archived => "done",
        }
    }
}

fn ${p.verb}_summary(statuses: &[Status]) -> String {
    statuses
        .iter()
        .filter(|s| **s != Status::Archived)
        .map(|s| s.describe())
        .collect::<Vec<_>>()
        .join(", ")
}

fn main() {
    let statuses: Vec<Status> = (0..${p.count})
        .map(|i| if i % 2 == 0 { Status::Active } else { Status::Pending })
        .collect();

    let summary = ${p.verb}_summary(&statuses);
    println!("{summary}");

    let first_active = statuses.iter().find(|s| **s == Status::Active);
    if let Some(status) = first_active {
        println!("first active: {}", status.describe());
    }
}
`;
};

const rustC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `use std::fmt;

trait Notifier {
    fn notify(&self, message: &str);
}

struct Logger;

impl Notifier for Logger {
    fn notify(&self, message: &str) {
        println!("[log] {message}");
    }
}

struct ${p.entity}<'a> {
    id: u32,
    ${p.field}: &'a str,
}

impl<'a> fmt::Display for ${p.entity}<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "#{} ({})", self.id, self.${p.field})
    }
}

fn ${p.verb}_all<T: fmt::Display>(items: &[T], notifier: &dyn Notifier) {
    for item in items {
        notifier.notify(&format!("${p.verb}: {item}"));
    }
}

macro_rules! ${p.entityLower}_vec {
    ($($id:expr),* $(,)?) => {
        vec![$(${p.entity} { id: $id, ${p.field}: "${p.word}" }),*]
    };
}

fn main() {
    let items = ${p.entityLower}_vec![1, 2, 3];
    let notifier: Box<dyn Notifier> = Box::new(Logger);

    ${p.verb}_all(&items[..items.len().min(${p.count})], notifier.as_ref());

    let describe = |count: usize| -> String { format!("{count} item(s) processed") };
    println!("{}", describe(items.len()));
}
`;
};

export const rust: SampleGenerator = (seed) => variantOf(seed, [rustA, rustB, rustC]);

// ---------- PHP ----------

const phpA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `<?php

declare(strict_types=1);

namespace App\\Registry;

class ${p.entity}
{
    public function __construct(
        public readonly int $id,
        public string $${p.field} = "${p.word}",
    ) {}
}

class ${p.entity}Registry
{
    /** @var array<int, ${p.entity}> */
    private array $items = [];

    public function __construct(private int $maxItems = ${p.count}) {}

    public function ${p.verb}(${p.entity} $item): bool
    {
        if (count($this->items) >= $this->maxItems) {
            return false;
        }
        $this->items[$item->id] = $item;
        return true;
    }

    public function find(int $id): ?${p.entity}
    {
        return $this->items[$id] ?? null;
    }
}

$registry = new ${p.entity}Registry();
$registry->${p.verb}(new ${p.entity}(id: 1, ${p.field}: "${p.word}"));
echo json_encode(["count" => count($registry->find(1) ? [1] : [])]);
`;
};

const phpB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `<?php

declare(strict_types=1);

namespace App\\Registry;

enum Status: string
{
    case Pending = 'pending';
    case Active = 'active';
    case Archived = 'archived';

    public function describe(): string
    {
        return match ($this) {
            Status::Pending => 'waiting',
            Status::Active => 'in progress',
            Status::Archived => 'done',
        };
    }
}

interface ${p.entity}Source
{
    public function ${p.verb}All(): array;
}

trait LogsActivity
{
    private array $log = [];

    protected function record(string $message): void
    {
        $this->log[] = $message;
    }
}

class ${p.entity}Service implements ${p.entity}Source
{
    use LogsActivity;

    public function ${p.verb}All(): array
    {
        $this->record("${p.verb} started");
        return array_map(
            fn (int $id) => ['id' => $id, 'status' => Status::Active],
            range(1, ${p.count}),
        );
    }
}

$service = new ${p.entity}Service();
foreach ($service->${p.verb}All() as $item) {
    echo "{$item['id']}: {$item['status']->describe()}\\n";
}
`;
};

const phpC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `<?php

declare(strict_types=1);

namespace App\\Registry;

#[Attribute]
class Tracked
{
    public function __construct(public string $label = "${p.word}") {}
}

abstract class ${p.entity}Base
{
    abstract public function ${p.verb}(): \\Generator;

    public function first(): mixed
    {
        foreach ($this->${p.verb}() as $item) {
            return $item;
        }
        return null;
    }
}

#[Tracked("${p.word}")]
class ${p.entity}Stream extends ${p.entity}Base
{
    public function __construct(private int $limit = ${p.count}) {}

    public function ${p.verb}(): \\Generator
    {
        for ($i = 0; $i < $this->limit; $i++) {
            yield ["id" => $i, "${p.field}" => "${p.word}"];
        }
    }
}

$stream = new ${p.entity}Stream();
$mapper = strtoupper(...);

foreach ($stream->${p.verb}() as $item) {
    echo $mapper($item["${p.field}"]) . "\\n";
}

echo ($stream->first()["${p.field}"] ?? "none") . "\\n";
`;
};

export const php: SampleGenerator = (seed) => variantOf(seed, [phpA, phpB, phpC]);

// ---------- HTML ----------

const htmlA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${p.entity} Dashboard</title>
  <link rel="stylesheet" href="/styles/main.css" />
</head>
<body data-theme="${p.word}">
  <header class="app-header">
    <h1>${p.entity} Registry</h1>
    <button id="${p.verb}-btn" type="button" disabled>${p.verb}</button>
  </header>
  <main>
    <!-- renders up to ${p.count} items -->
    <ul class="item-list">
      <li data-id="1">${p.word}</li>
    </ul>
  </main>
  <script>
    document.getElementById("${p.verb}-btn").addEventListener("click", () => {
      console.log("${p.verb} clicked");
    });
  </script>
</body>
</html>
`;
};

const htmlB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${cap(p.verb)} ${p.entity}</title>
</head>
<body>
  <nav aria-label="breadcrumb">
    <a href="/">Home</a> / <span>${p.entity}s</span>
  </nav>

  <article>
    <h1>${cap(p.verb)} ${p.entity}</h1>
    <form method="post" action="/${p.entityLower}s" novalidate>
      <label for="name">Name</label>
      <input id="name" name="name" type="text" required maxlength="${p.count}" />

      <label for="status">Status</label>
      <select id="status" name="status">
        <option value="pending">Pending</option>
        <option value="active" selected>Active</option>
      </select>

      <input type="checkbox" id="notify" name="notify" checked />
      <label for="notify">Notify on ${p.word}</label>

      <button type="submit">Save</button>
    </form>

    <table>
      <thead>
        <tr><th>ID</th><th>${cap(p.field)}</th></tr>
      </thead>
      <tbody>
        <tr><td>1</td><td>${p.word}</td></tr>
      </tbody>
    </table>
  </article>
</body>
</html>
`;
};

const htmlC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${p.entity} Panel</title>
  <template id="${p.entityLower}-row-template">
    <li class="${p.entityLower}-row">
      <span class="label"></span>
      <button type="button" data-action="${p.verb}">${cap(p.verb)}</button>
    </li>
  </template>
</head>
<body>
  <section aria-labelledby="${p.entityLower}-heading">
    <h1 id="${p.entityLower}-heading">${p.entity}s</h1>

    <dialog id="confirm-${p.verb}">
      <p>${cap(p.verb)} this ${p.entityLower}?</p>
      <button value="cancel">Cancel</button>
      <button value="confirm" autofocus>Confirm</button>
    </dialog>

    <ul id="${p.entityLower}-list" aria-live="polite"></ul>
  </section>

  <script type="module">
    class ${p.entity}Row extends HTMLElement {
      static observedAttributes = ["${p.field}"];

      connectedCallback() {
        const template = document.getElementById("${p.entityLower}-row-template");
        this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true));
      }

      attributeChangedCallback(name, _old, value) {
        if (name === "${p.field}") {
          this.shadowRoot.querySelector(".label").textContent = value ?? "${p.word}";
        }
      }
    }

    customElements.define("${p.entityLower}-row", ${p.entity}Row);
  </script>
</body>
</html>
`;
};

export const html: SampleGenerator = (seed) => variantOf(seed, [htmlA, htmlB, htmlC]);

// ---------- CSS ----------

const cssA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `:root {
  --${p.entityLower}-accent: #5b8def;
  --spacing-unit: 8px;
}

.${p.entityLower}-card {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing-unit) * 2);
  padding: 1.5rem;
  border-radius: 8px;
  background: linear-gradient(135deg, #1e1e1e, #2a2a2a);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.${p.entityLower}-card[data-status="${p.word}"] {
  border-left: 3px solid var(--${p.entityLower}-accent);
}

.${p.entityLower}-card > .title {
  font-weight: 600;
  font-size: 1.1rem;
}

@media (max-width: 640px) {
  .${p.entityLower}-card {
    padding: 1rem;
  }
}
`;
};

const cssB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `.${p.entityLower}-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${p.count}0px, 1fr));
  gap: 1rem;
}

.${p.entityLower}-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  opacity: 0;
  animation: fade-in 300ms ease forwards;
}

.${p.entityLower}-item:hover,
.${p.entityLower}-item:focus-within {
  outline: 2px solid dodgerblue;
}

.${p.entityLower}-item:nth-child(odd) {
  background: rgba(255, 255, 255, 0.03);
}

.${p.entityLower}-item::before {
  content: "${p.word}";
  font-size: 0.75rem;
  text-transform: uppercase;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@supports (gap: 1rem) {
  .${p.entityLower}-grid {
    gap: clamp(0.5rem, 2vw, 1.5rem);
  }
}
`;
};

const cssC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `.${p.entityLower}-panel {
  container-type: inline-size;
  container-name: ${p.entityLower}-panel;

  padding-inline: clamp(1rem, 2vw, 2rem);
  padding-block: 1rem;

  & > .header {
    font-weight: 600;

    &:hover {
      color: color-mix(in srgb, currentColor 80%, transparent);
    }
  }

  &:has(> .badge[data-status="${p.word}"]) {
    border-inline-start: 3px solid dodgerblue;
  }
}

@container ${p.entityLower}-panel (min-width: 480px) {
  .${p.entityLower}-panel {
    display: grid;
    grid-template-columns: auto 1fr;
  }
}

.${p.entityLower}-badge {
  --badge-count: ${p.count};
  inset-block-start: 0;
  inset-inline-end: 0;
  aspect-ratio: 1 / 1;
}

@layer components {
  .${p.entityLower}-badge::after {
    content: counter(badge, decimal-leading-zero);
  }
}
`;
};

export const css: SampleGenerator = (seed) => variantOf(seed, [cssA, cssB, cssC]);

// ---------- JSON ----------

const jsonA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `{
  "name": "${p.entityLower}-registry",
  "version": "1.0.0",
  "maxItems": ${p.count},
  "status": "${p.word}",
  "tags": ["core", "registry", "${p.word}"],
  "owner": {
    "id": 1,
    "${p.field}": "${p.word}",
    "active": true,
    "notes": null
  },
  "hooks": {
    "on${cap(p.verb)}": "./hooks/${p.verb}.js"
  }
}
`;
};

const jsonB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `{
  "${p.entityLower}s": [
    { "id": 1, "${p.field}": "${p.word}", "active": true },
    { "id": 2, "${p.field}": null, "active": false }
  ],
  "pagination": {
    "page": 1,
    "pageSize": ${p.count},
    "hasMore": false
  },
  "permissions": ["${p.verb}", "read", "delete"],
  "meta": {
    "generatedAt": "2024-01-01T00:00:00Z",
    "source": "${p.entityLower}-service",
    "debug": false
  }
}
`;
};

const jsonC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `{
  "$schema": "https://example.com/schemas/${p.entityLower}.json",
  "${p.entityLower}": {
    "id": 1,
    "${p.field}": "${p.word}",
    "score": -12.5,
    "ratio": 0.${p.count}25,
    "coordinates": [40.7128, -74.006],
    "metadata": {
      "flags": [true, false, null],
      "labels": ["${p.word}", "${p.field}", null],
      "nested": {
        "depth": 2,
        "items": [
          { "id": 1, "value": 1e3 },
          { "id": 2, "value": null }
        ]
      }
    }
  },
  "history": [],
  "checksum": "sha256:0000000000000000000000000000000000000000000000000000000000",
  "verified": false
}
`;
};

export const json: SampleGenerator = (seed) => variantOf(seed, [jsonA, jsonB, jsonC]);

// ---------- SQL ----------

const sqlA: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `-- ${p.entity} registry schema and seed data
CREATE TABLE ${p.entityLower}_registry (
    id            SERIAL PRIMARY KEY,
    ${p.field}        VARCHAR(64) NOT NULL DEFAULT '${p.word}',
    ${p.field2}       TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_${p.entityLower}_status ON ${p.entityLower}_registry (${p.field});

INSERT INTO ${p.entityLower}_registry (${p.field}, is_active)
VALUES ('${p.word}', TRUE), ('draft', FALSE);

SELECT id, ${p.field}, COUNT(*) OVER (PARTITION BY ${p.field}) AS group_count
FROM ${p.entityLower}_registry
WHERE is_active = TRUE
  AND ${p.field} <> 'archived'
ORDER BY ${p.field2} DESC
LIMIT ${p.count};
`;
};

const sqlB: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `-- ${p.entity} report: joins, grouping, and a CTE
WITH recent_${p.entityLower}s AS (
    SELECT id, ${p.field}, owner_id
    FROM ${p.entityLower}_registry
    WHERE ${p.field2} > NOW() - INTERVAL '${p.count} days'
)
SELECT
    o.name AS owner_name,
    COUNT(r.id) AS total,
    CASE
        WHEN COUNT(r.id) > ${p.count} THEN 'high'
        WHEN COUNT(r.id) > 0 THEN 'normal'
        ELSE 'none'
    END AS volume
FROM owners o
LEFT JOIN recent_${p.entityLower}s r ON r.owner_id = o.id
GROUP BY o.name
HAVING COUNT(r.id) > 0
ORDER BY total DESC;

UPDATE ${p.entityLower}_registry
SET ${p.field} = '${p.word}'
WHERE id IN (SELECT id FROM recent_${p.entityLower}s);

DELETE FROM ${p.entityLower}_registry
WHERE ${p.field} = 'archived' AND ${p.field2} < NOW() - INTERVAL '365 days';
`;
};

const sqlC: SampleGenerator = (seed) => {
  const p = pools(seed);
  return `-- ${p.entity} maintenance: transaction, procedure, and a trigger
BEGIN TRANSACTION;

CREATE OR REPLACE FUNCTION ${p.entityLower}_${p.verb}(p_id INT, p_${p.field} VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE ${p.entityLower}_registry
    SET ${p.field} = p_${p.field}
    WHERE id = p_id;

    IF NOT FOUND THEN
        INSERT INTO ${p.entityLower}_registry (id, ${p.field})
        VALUES (p_id, p_${p.field});
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_${p.entityLower}_audit
AFTER UPDATE ON ${p.entityLower}_registry
FOR EACH ROW
EXECUTE FUNCTION log_${p.entityLower}_change();

SELECT id, ${p.field} FROM ${p.entityLower}_registry WHERE ${p.field} = '${p.word}'
UNION
SELECT id, ${p.field} FROM ${p.entityLower}_archive WHERE ${p.field} = '${p.word}'
ORDER BY id
LIMIT ${p.count};

COMMIT;
`;
};

export const sql: SampleGenerator = (seed) => variantOf(seed, [sqlA, sqlB, sqlC]);
