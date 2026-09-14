// src/pages/ConversionInfoPage.jsx
import React from 'react';

export function ConversionInfoPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold font-display text-white mb-4">
        Como funcionam as conversões
      </h1>
      <section className="text-white">
        <p className="mb-4">
          A conversão de tamanhos serve para ajudar o cliente a entender a equivalência entre as numerações apresentadas no catálogo e os padrões utilizados no Brasil e na Europa.
        </p>
      </section>
      <section className="text-white">
        <h2 className="text-2xl font-semibold mb-2">1. Conversão de tamanhos</h2>
        <p className="mb-4">
          Consulte a tabela de equivalência antes de escolher o seu tamanho. Cada produto indica a numeração original e, ao lado, a correspondente nas regiões BR e EUR.
        </p>
      </section>
      <section className="text-white">
        <h2 className="text-2xl font-semibold mb-2">2. Brasil (BR) x Europa (EUR)</h2>
        <p className="mb-4">
          As numerações podem variar entre os fabricantes. A tabela abaixo mostra a relação geral entre os sistemas BR e EUR, mas verifique sempre a conversão específica indicada para o produto.
        </p>
      </section>
      <section className="text-white">
        <h2 className="text-2xl font-semibold mb-2">3. Como escolher o tamanho</h2>
        <p className="mb-4">
          Verifique a tabela/conversão indicada no produto. Em caso de dúvidas, entre em contato com o nosso atendimento pelo WhatsApp antes de finalizar a compra.
        </p>
      </section>
      <section className="text-white">
        <h2 className="text-2xl font-semibold mb-2">4. Importante</h2>
        <p>
          As numerações podem variar conforme o fabricante ou modelo. A conversão apresentada serve apenas como referência.
        </p>
      </section>
    </div>
  );
}
