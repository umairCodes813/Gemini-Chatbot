// Fake streaming reply so the UI can be tested without an API key (MOCK_LLM=true).
const TEXT = `This is a **mock reply** to test the interface.

- Streaming works
- Markdown works

\`\`\`js
console.log("code blocks have a copy button");
\`\`\`

A [link](https://example.com) and some \`inline code\`.`;

export function mockStream() {
  const controller = new AbortController();

  async function* generate() {
    for (const piece of TEXT.split(/(\s+)/)) {
      if (controller.signal.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, 30));
      yield { choices: [{ delta: { content: piece } }] };
    }
  }

  const iterator = generate();
  return { controller, [Symbol.asyncIterator]: () => iterator };
}
