// Dependency-free evaluator for every keyword in the locked model schema.
// Unknown validation keywords fail closed rather than silently weakening a newer schema.
const SUPPORTED = new Set(['$schema','$id','$defs','$ref','title','description','type','const','enum','required','properties','additionalProperties','items','minItems','maxItems','minLength','pattern','minimum','allOf','anyOf','oneOf','not','if','then','else']);
export function checkSchemaSupport(schema) {
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (node.$ref && Object.keys(node).some(key => !['$ref','description','title'].includes(key))) throw Error('Unsupported validation siblings beside $ref');
    for (const key of Object.keys(node)) if (!SUPPORTED.has(key)) throw Error('Unsupported schema keyword: ' + key);
    for (const key of ['$defs','properties']) for (const child of Object.values(node[key] || {})) walk(child);
    for (const key of ['items','not','if','then','else']) if (node[key]) walk(node[key]);
    for (const key of ['allOf','anyOf','oneOf']) for (const child of node[key] || []) walk(child);
  }; walk(schema);
}
export function structuralErrors(value, schema) {
  checkSchemaSupport(schema);
  const resolve = ref => { if (!ref.startsWith('#/')) throw Error('Only locked local schema refs are supported'); return ref.slice(2).split('/').reduce((node,key)=>node?.[key.replace(/~1/g,'/').replace(/~0/g,'~')],schema); };
  const visit = (value, rule, where, depth = 0) => {
    if (depth > 100) return [where + ': schema depth exceeded'];
    if (rule.$ref) return visit(value, resolve(rule.$ref), where, depth + 1);
    const errors = [], add = text => errors.push(where + ': ' + text);
    if ('const' in rule && value !== rule.const) add('const mismatch');
    if (rule.enum && !rule.enum.includes(value)) add('enum mismatch');
    const object = value !== null && typeof value === 'object' && !Array.isArray(value);
    if (rule.type) {
      const matches = rule.type === 'object' ? object : rule.type === 'array' ? Array.isArray(value) : rule.type === 'null' ? value === null : rule.type === 'integer' ? Number.isSafeInteger(value) : typeof value === rule.type;
      if (!matches) return [...errors, where + ': expected ' + rule.type];
    }
    if (object) {
      for (const key of rule.required || []) if (!Object.hasOwn(value,key)) add('missing ' + key);
      for (const key of Object.keys(value)) {
        if (rule.additionalProperties === false && !Object.hasOwn(rule.properties || {},key)) add('unexpected ' + key);
        if (rule.properties?.[key]) errors.push(...visit(value[key],rule.properties[key],where+'.'+key,depth+1));
      }
    }
    if (Array.isArray(value)) {
      if (rule.minItems !== undefined && value.length < rule.minItems) add('too few items');
      if (rule.maxItems !== undefined && value.length > rule.maxItems) add('too many items');
      if (rule.items) value.forEach((item,index)=>errors.push(...visit(item,rule.items,where+'['+index+']',depth+1)));
    }
    if (typeof value === 'string') {
      if (rule.minLength !== undefined && Array.from(value).length < rule.minLength) add('too short');
      if (rule.pattern && !new RegExp(rule.pattern,'u').test(value)) add('pattern mismatch');
    }
    if (typeof value === 'number' && rule.minimum !== undefined && value < rule.minimum) add('below minimum');
    for (const child of rule.allOf || []) errors.push(...visit(value,child,where,depth+1));
    if (rule.anyOf && !rule.anyOf.some(child=>visit(value,child,where,depth+1).length===0)) add('anyOf mismatch');
    if (rule.oneOf && rule.oneOf.filter(child=>visit(value,child,where,depth+1).length===0).length!==1) add('oneOf mismatch');
    if (rule.not && visit(value,rule.not,where,depth+1).length===0) add('not mismatch');
    if (rule.if) { const branch=visit(value,rule.if,where,depth+1).length===0?rule.then:rule.else; if(branch)errors.push(...visit(value,branch,where,depth+1)); }
    return errors;
  };
  return visit(value,schema,'$');
}
