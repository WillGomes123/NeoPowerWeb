import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, 'src', 'pages');

const files = [
  'Stations.tsx',
  'Locations.tsx',
  'Transactions.tsx',
  'Indicators.tsx',
  'Operations.tsx',
  'FinancialReport.tsx',
  'Users.tsx',
  'Vouchers.tsx'
];

files.forEach(file => {
  const filePath = path.join(pagesDir, file);

  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Adicionar import do api helper se não existir
    if (!content.includes("import { api } from '../lib/api'")) {
      // Encontrar a última linha de import
      const lastImportIndex = content.lastIndexOf('\nimport ');
      if (lastImportIndex !== -1) {
        const endOfLine = content.indexOf('\n', lastImportIndex + 1);
        content = content.slice(0, endOfLine + 1) + "import { api } from '../lib/api';\n" + content.slice(endOfLine + 1);
      }
    }

    // Remover declaração de API_BASE_URL se existir
    content = content.replace(/const API_BASE_URL = ['"][^'"]*['"];?\n?/g, '');

    // Substituir fetch por api.get/post/put/delete
    // GET requests
    content = content.replace(
      /fetch\(\s*`\$\{API_BASE_URL\}([^`]+)`[^)]*\)/g,
      'api.get(\'$1\')'
    );
    content = content.replace(
      /fetch\(\s*['"]\/api([^'"]+)['"]\s*,\s*\{[^}]*method:\s*['"]GET['"][^}]*\}\s*\)/g,
      'api.get(\'/api$1\')'
    );

    // POST requests
    content = content.replace(
      /fetch\(\s*`\$\{API_BASE_URL\}([^`]+)`\s*,\s*\{([^}]*method:\s*['"]POST['"][^}]*)\}\s*\)/g,
      (match, url, options) => {
        if (options.includes('body:')) {
          const bodyMatch = options.match(/body:\s*JSON\.stringify\(([^)]+)\)/);
          if (bodyMatch) {
            return `api.post('${url}', ${bodyMatch[1]})`;
          }
        }
        return `api.post('${url}')`;
      }
    );

    // PUT requests
    content = content.replace(
      /fetch\(\s*`\$\{API_BASE_URL\}([^`]+)`\s*,\s*\{([^}]*method:\s*['"]PUT['"][^}]*)\}\s*\)/g,
      (match, url, options) => {
        if (options.includes('body:')) {
          const bodyMatch = options.match(/body:\s*JSON\.stringify\(([^)]+)\)/);
          if (bodyMatch) {
            return `api.put('${url}', ${bodyMatch[1]})`;
          }
        }
        return `api.put('${url}')`;
      }
    );

    // DELETE requests
    content = content.replace(
      /fetch\(\s*`\$\{API_BASE_URL\}([^`]+)`\s*,\s*\{[^}]*method:\s*['"]DELETE['"][^}]*\}\s*\)/g,
      'api.delete(\'$1\')'
    );

    // Remover headers de autenticação manual (x-user-role, etc)
    content = content.replace(/headers:\s*\{\s*['"]x-user-role['"]\s*:\s*userRole\s*\|\|\s*['"]['"][^}]*\},?\s*/g, '');
    content = content.replace(/const\s+userRole\s*=\s*localStorage\.getItem\(['"]userRole['"]\);?\n?/g, '');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Atualizado: ${file}`);
  } else {
    console.log(`⚠️  Não encontrado: ${file}`);
  }
});

console.log('\n🎉 Todas as páginas foram atualizadas!');
