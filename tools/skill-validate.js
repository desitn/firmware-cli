#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..', 'skill', 'dove');
const schemaPath = path.join(base, 'meta', 'schema.json');
function error(msg){ console.error('ERROR: ' + msg); }
function info(msg){ console.log('OK: ' + msg); }
if(!fs.existsSync(schemaPath)){
  error('schema.json not found: ' + schemaPath);
  process.exit(2);
}
const schema = JSON.parse(fs.readFileSync(schemaPath,'utf8'));
function validateMeta(obj){
  const required = schema.required || [];
  const missing = required.filter(k=> !(k in obj));
  const errors = [];
  if(missing.length) errors.push('missing required: ' + missing.join(','));
  if(obj.errorHandling){
    if(typeof obj.errorHandling.retries !== 'number') errors.push('errorHandling.retries must be number');
    if(typeof obj.errorHandling.timeoutMs !== 'number') errors.push('errorHandling.timeoutMs must be number');
  }
  return errors;
}
function walk(dir){
  const files = fs.readdirSync(dir);
  files.forEach(f=>{
    const p = path.join(dir,f);
    const stat = fs.statSync(p);
    if(stat.isDirectory()) return walk(p);
    if(/-meta\.json$/.test(f)){
      let content;
      try{ content = JSON.parse(fs.readFileSync(p,'utf8')); }
      catch(e){ error(p + ' invalid JSON: ' + e.message); process.exitCode = 1; return; }
      const errs = validateMeta(content);
      if(errs.length){ error(p + ' -> ' + errs.join('; ')); process.exitCode = 1; }
      else info(p + ' validated');
    }
  });
}
walk(base);
if(process.exitCode && process.exitCode !== 0){ console.error('Validation failed'); process.exit(process.exitCode); }
else console.log('All metadata validated.');
