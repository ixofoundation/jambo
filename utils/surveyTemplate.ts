export function findQuestionByName(template: any, name: string): any | null {
  if (!template || typeof template !== 'object') return null;
  const root = template.question ?? template;
  const visit = (node: any): any | null => {
    if (!node || typeof node !== 'object') return null;
    if (node.name === name || node.valueName === name) return node;
    const children: any[] = [];
    if (Array.isArray(node.pages)) children.push(...node.pages);
    if (Array.isArray(node.elements)) children.push(...node.elements);
    if (Array.isArray(node.templateElements)) children.push(...node.templateElements);
    for (const child of children) {
      const hit = visit(child);
      if (hit) return hit;
    }
    return null;
  };
  return visit(root);
}

export function templateRequiresBaseClaim(template: any): boolean {
  return findQuestionByName(template, 'ixo:baseClaimCID') != null;
}
