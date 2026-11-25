export function chunksOf<Item>({ items, size }: { items: Item[]; size: number }): Item[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export function inSequence<Item, Result>({ items, step }: { items: Item[]; step: (item: Item) => Promise<Result> }): Promise<Result[]> {
  return items.reduce(async (previous, item) => {
    const results = await previous;
    return [...results, await step(item)];
  }, Promise.resolve<Result[]>([]));
}
