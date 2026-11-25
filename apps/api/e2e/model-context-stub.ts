export enum ModelContextOwner {
  Document = 'document',
  Navigator = 'navigator',
}

const MODEL_CONTEXT_REGISTRY = `window.registeredTools = [];
window.callTool = async (name, input) => {
  const registered = window.registeredTools.find((entry) => entry.tool.name === name);
  const result = await registered.tool.execute(input, {});
  return result.content[0].text;
};`;

function modelContextOf(owner: ModelContextOwner): string {
  return `Object.defineProperty(${owner}, 'modelContext', {
  configurable: true,
  value: { registerTool: (tool) => { window.registeredTools.push({ owner: '${owner}', tool }); return Promise.resolve(); } },
});`;
}

export const DOCUMENT_MODEL_CONTEXT_STUB = `{
${MODEL_CONTEXT_REGISTRY}
${modelContextOf(ModelContextOwner.Document)}
}`;

export const NAVIGATOR_MODEL_CONTEXT_STUB = `{
${MODEL_CONTEXT_REGISTRY}
${modelContextOf(ModelContextOwner.Navigator)}
}`;

export const BOTH_MODEL_CONTEXT_STUB = `{
${MODEL_CONTEXT_REGISTRY}
${modelContextOf(ModelContextOwner.Document)}
${modelContextOf(ModelContextOwner.Navigator)}
}`;

export const NO_MODEL_CONTEXT_STUB = `{
${MODEL_CONTEXT_REGISTRY}
}`;
