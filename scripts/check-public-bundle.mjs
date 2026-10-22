import { readFile, readdir } from "node:fs/promises";

const history = JSON.parse(await readFile(new URL("../src/real-cash.json", import.meta.url), "utf8"));
const forbidden = [...history.flatMap(record => [record.sourceUrl, record.file]), "Fornecedor exemplo A", "Registro diário fictício", "danielli-demo-v2:", "postgresql://", "scrypt$v1$"];
const assets = new URL("../dist/assets/", import.meta.url);
const files = (await readdir(assets)).filter(name => /\.(?:js|map)$/.test(name));
if (!files.length) throw new Error("O build não gerou arquivos para conferir.");
for (const file of files) {
  const text = await readFile(new URL(file, assets), "utf8");
  if (forbidden.some(marker => marker && text.includes(marker))) {
    throw new Error(`O pacote público ${file} contém uma fonte histórica, dado fictício ou configuração reservada.`);
  }
}
console.log(`Pacote público verificado: ${files.length} arquivo(s), sem histórico, exemplos ou credenciais embutidos.`);
