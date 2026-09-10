import type { FlowNode } from './recipe-schema';

const cookingTypes = new Set<FlowNode['type']>([
  'cook',
  'bake',
  'boil',
  'fry',
]);
const finishingTypes = new Set<FlowNode['type']>(['cool', 'serve']);

const cookingWords = /\b(?:bake|cook|roast|grill|boil|simmer|fry|saute|sauté|steam|poach|sear|backen|kochen|braten|grillen|köcheln|cuire|mijoter|frire|rôtir|griller|hornear|cocinar|hervir|freír|asar|cuocere|bollire|friggere|arrostire|cozinhar|assar|ferver|fritar|koken|bakken|braden|frituren|masak|bakar|rebus|goreng|kukus|panggang|reneh|pişir|kaynat|kızart|ızgara|fırınla)\b|烤|煮|炒|煎|蒸|焼|揚|굽|끓|볶|튀|찌|อบ|ต้ม|ทอด|ผัด|นึ่ง|اخبز|اطبخ|اغل|اقلي|اشو|बेक|पकाएँ|उबाल|तल|भून|भाप/iu;
const finishingWords = /\b(?:cool|chill|garnish|serve|plate|slice|rest before|let stand|abkühlen|garnieren|servieren|refroidir|garnir|servir|enfriar|decorar|servir|raffreddare|guarnire|servire|esfriar|decorar|servir|afkoelen|garneren|serveren|sejukkan|hiaskan|hidangkan|dinginkan|sajikan|soğut|süsle|servis)\b|冷却|放凉|装饰|上桌|冷ます|盛り付け|식히|장식|내놓|พักให้เย็น|ตกแต่ง|เสิร์ฟ|برد|زيّن|قدم|ठंडा|सजाएँ|परोसें/iu;

function searchableText(node: FlowNode): string {
  return `${node.label} ${node.detail ?? ''}`.toLocaleLowerCase();
}

export function containsCookingKeyword(text: string): boolean {
  return cookingWords.test(text.toLocaleLowerCase());
}

export function containsFinishingKeyword(text: string): boolean {
  return finishingWords.test(text.toLocaleLowerCase());
}

export function isCookingNode(node: FlowNode): boolean {
  return cookingTypes.has(node.type) || containsCookingKeyword(searchableText(node));
}

export function isFinishingNode(node: FlowNode): boolean {
  return finishingTypes.has(node.type) || containsFinishingKeyword(searchableText(node));
}

export function splitFlowPhases(flow: FlowNode[]): {
  prepare: FlowNode[];
  cook: FlowNode[];
  finish: FlowNode[];
} {
  if (flow.length === 0) return { prepare: [], cook: [], finish: [] };
  const firstCook = flow.findIndex(isCookingNode);
  const lastSteps = Math.min(3, Math.max(1, Math.ceil(flow.length / 4)));
  if (firstCook < 0) {
    // For no-heat recipes, reserve the final one to three actions for plating,
    // resting, or serving so Finish always communicates a real endpoint.
    const finishStart = Math.max(1, flow.length - lastSteps);
    const cookStart = Math.max(0, finishStart - 1);
    return {
      prepare: flow.slice(0, cookStart),
      cook: flow.slice(cookStart, finishStart),
      finish: flow.slice(finishStart),
    };
  }

  const finishOffset = flow.slice(firstCook + 1).findIndex(isFinishingNode);
  const firstFinish = finishOffset < 0
    ? Math.max(firstCook + 1, flow.length - lastSteps)
    : firstCook + 1 + finishOffset;

  // A single terminal cooking action still doubles as the finished result.
  // This keeps the visual workflow useful for short extracted recipes.
  const finishBoundary = Math.min(flow.length - 1, Math.max(firstCook, firstFinish));

  return {
    prepare: flow.slice(0, firstCook),
    cook: flow.slice(firstCook, finishBoundary),
    finish: flow.slice(finishBoundary),
  };
}
