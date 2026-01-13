import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, 'src', 'pages');

// Padrões problemáticos criados pelo script anterior
const patterns = [
  // api.get('/path') })
  { regex: /api\.get\((['"`])([^'"`]+)\1\)\s*\}\)/g, replace: "api.get('$2')" },
  { regex: /api\.post\((['"`])([^'"`]+)\1\)\s*\}\)/g, replace: "api.post('$2')" },
  { regex: /api\.put\((['"`])([^'"`]+)\1\)\s*\}\)/g, replace: "api.put('$2')" },
  { regex: /api\.delete\((['"`])([^'"`]+)\1\)\s*\}\)/g, replace: "api.delete('$2')" },

  // Remover }); sobrando na próxima linha
  { regex: /\n\s*\}\);\s*\n/g, replace: '\n' }
];

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  patterns.forEach(({ regex, replace }) => {
    if (regex.test(content)) {
      content = content.replace(regex, replace);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Corrigido: ${file}`);
  }
});

console.log('\n🎉 Correções aplicadas!');
