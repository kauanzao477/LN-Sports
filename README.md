# LN Sports — Loja Virtual (v1)

Loja virtual estilo outlet para a LN Sports. Nesta primeira versão não há
checkout: o cliente encontra o produto, copia o código e finaliza a compra
pelo Instagram da loja.

## Rodando o projeto

Pré-requisito: Node.js 18 ou superior.

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (geralmente `http://localhost:5173`).

Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

## Estrutura

```
src/
  components/    componentes reutilizáveis (ProductCard, Header, etc.)
  layouts/       layout que envolve as páginas (Header + conteúdo + Footer)
  pages/         cada rota da aplicação
  data/          dados estáticos: categorias e produtos MOCK
  services/      camada de acesso a dados (produtos) + importador
  config/        configuração central da marca (Instagram, textos)
  utils/         funções auxiliares (formatação, slug, imagem placeholder)
  styles/        tokens de design e CSS global
```

## Onde editar quando os dados reais chegarem

1. **Instagram / textos da marca** → `src/config/site.js`.
2. **Categorias** → `src/data/categories.js` (adicione, remova ou reordene
   livremente; cada categoria vira automaticamente um filtro em `/produtos`).
3. **Os ~4.000 produtos reais** → NÃO edite `src/data/products.js` à mão.
   Esse arquivo contém apenas produtos **fictícios** (mock), usados só para
   construir e testar a interface.

   Quando o JSON/CSV real existir, use o normalizador já pronto em
   `src/services/productImport.js`:

   ```js
   import produtosReaisRaw from '../../produtos-reais.json'
   import { normalizeCatalog } from './productImport'

   const { products, errors } = normalizeCatalog(produtosReaisRaw)
   ```

   Depois, em `src/services/productService.js`, troque a função `getSource()`
   para retornar os produtos reais no lugar de `MOCK_PRODUCTS`. Nenhuma
   página ou componente precisa mudar — todos consomem os dados através
   de `productService.js`.

   Se um produto não tiver alguma informação (ex: sem cor cadastrada), o
   importador não inventa nada: o campo fica vazio/nulo.

## O que ainda não existe (de propósito)

Checkout, pagamento, login, painel administrativo, banco de dados e
integração com fornecedor não foram implementados nesta primeira versão —
a arquitetura (camada `services/`, estrutura de dados dos produtos) já foi
pensada para receber essas funcionalidades depois, sem reescrever o projeto.

## Sobre hospedagem

Ainda não é o momento — o projeto está pronto para ser hospedado quando
você decidir (Vercel, Netlify, servidor próprio etc.), mas isso não faz
parte desta entrega.
