export class MinHeap<T> {
  private heap: { key: number; value: T }[] = [];

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  insert(key: number, value: T) {
    this.heap.push({ key, value });
    this.bubbleUp();
  }

  extractMin(): T | null {
    if (this.isEmpty()) return null;

    const min = this.heap[0].value;
    const end = this.heap.pop()!;

    if (!this.isEmpty()) {
      this.heap[0] = end;
      this.bubbleDown();
    }

    return min;
  }

  private bubbleUp() {
    let index = this.heap.length - 1;

    while (index > 0) {
      let parent = Math.floor((index - 1) / 2);

      if (this.heap[index].key >= this.heap[parent].key) break;

      [this.heap[index], this.heap[parent]] =
        [this.heap[parent], this.heap[index]];

      index = parent;
    }
  }

  private bubbleDown() {
    let index = 0;
    const length = this.heap.length;

    while (true) {
      let left = 2 * index + 1;
      let right = 2 * index + 2;
      let smallest = index;

      if (left < length &&
          this.heap[left].key < this.heap[smallest].key) {
        smallest = left;
      }

      if (right < length &&
          this.heap[right].key < this.heap[smallest].key) {
        smallest = right;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] =
        [this.heap[smallest], this.heap[index]];

      index = smallest;
    }
  }
}
